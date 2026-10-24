import { Employee } from 'src/app/infrastructure/types/employee';
import { csvCell, toCsv } from './people-table';

describe('people table CSV', () => {
  it('should leave ordinary values untouched', () => {
    expect(csvCell('Ada Lovelace')).toBe('Ada Lovelace');
    expect(csvCell("James O'Connor")).toBe("James O'Connor");
  });

  it('should quote values with commas, quotes or line breaks', () => {
    expect(csvCell('Moreau, Lucas')).toBe('"Moreau, Lucas"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('should defuse values a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://evil.example","x")')).toBe(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\t=1')).toBe("'\t=1");
  });

  it('should defuse a formula in an exported name', () => {
    const employee: Employee = {
      id: 1, firstName: '=cmd', lastName: 'Doe', email: 'x@acme.com', position: 'QA', level: 'Junior',
      isAvailable: true, profilePicture: '',
    };
    const [, row] = toCsv([employee], {}, () => 'In today').split('\r\n');
    expect(row.startsWith("'=cmd Doe,")).toBeTrue();
  });
});
