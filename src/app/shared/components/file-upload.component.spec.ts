import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FileUploadComponent } from './file-upload.component';
import { flushChanges } from 'src/testing/flush-changes';

function createFile(name: string, type: string): File {
  return new File(['content'], name, { type });
}

function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer();
  files.forEach(f => dataTransfer.items.add(f));
  return dataTransfer.files;
}

describe('FileUploadComponent', () => {
  let component: FileUploadComponent;
  let fixture: ComponentFixture<FileUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileUploadComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FileUploadComponent);
    component = fixture.componentInstance;
    component.label = 'Upload file';
    component.accept = ['image/png', 'image/jpeg'];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the label input', () => {
    const label: HTMLLabelElement = fixture.debugElement.query(By.css('label')).nativeElement;
    expect(label.textContent).toContain('Upload file');
  });

  it('should set the accept attribute from the accept input', () => {
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;
    expect(input.getAttribute('accept')).toBe('image/png,image/jpeg');
  });

  it('should transform a comma separated string into an array via the input transform', () => {
    fixture.componentRef.setInput('accept', 'text/csv,application/pdf');
    fixture.detectChanges();
    expect(component.accept).toEqual(['text/csv', 'application/pdf']);
  });

  it('should emit selected with the FileList when all files are of an accepted type', () => {
    const emitted: FileList[] = [];
    component.selected.subscribe(files => emitted.push(files));

    const files = createFileList([createFile('a.png', 'image/png')]);
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;
    Object.defineProperty(input, 'files', { value: files });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toBe(files);
    expect(component.errorMessage).toBe('');
  });

  it('should set an error message and not emit when a file type is not accepted', () => {
    const emitted: FileList[] = [];
    component.selected.subscribe(files => emitted.push(files));

    const files = createFileList([createFile('a.txt', 'text/plain')]);
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input')).nativeElement;
    Object.defineProperty(input, 'files', { value: files });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted.length).toBe(0);
    expect(component.errorMessage).toBe('Invalid file type');
  });

  it('should render the error message and accepted file types when errorMessage is set', () => {
    component.errorMessage = 'Invalid file type';
    flushChanges(fixture);

    const error = fixture.debugElement.query(By.css('.error'));
    expect(error).toBeTruthy();
    const items = fixture.debugElement.queryAll(By.css('.error li'));
    expect(items.length).toBe(2);
    expect(items[0].nativeElement.textContent).toContain('image/png');
    expect(items[1].nativeElement.textContent).toContain('image/jpeg');
  });

  it('should not render the error message when there is none', () => {
    component.errorMessage = '';
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.error'))).toBeFalsy();
  });
});
