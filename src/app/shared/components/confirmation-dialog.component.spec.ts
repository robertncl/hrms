import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';

describe('ConfirmationDialogComponent', () => {
  let component: ConfirmationDialogComponent;
  let fixture: ComponentFixture<ConfirmationDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmationDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be open by default', () => {
    expect(component.isConfirmationOpen).toBeTrue();
    const dialog: HTMLElement = fixture.debugElement.query(By.css('dialog')).nativeElement;
    expect(dialog.hasAttribute('open')).toBeTrue();
  });

  it('should close the dialog when Cancel is clicked', () => {
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const cancelButton: HTMLButtonElement = buttons[0].nativeElement;
    expect(cancelButton.textContent).toContain('Cancel');

    cancelButton.click();
    fixture.detectChanges();

    expect(component.isConfirmationOpen).toBeFalse();
    const dialog: HTMLElement = fixture.debugElement.query(By.css('dialog')).nativeElement;
    expect(dialog.hasAttribute('open')).toBeFalse();
  });

  it('should close the dialog when Confirm is clicked', () => {
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const confirmButton: HTMLButtonElement = buttons[1].nativeElement;
    expect(confirmButton.textContent).toContain('Confirm');

    confirmButton.click();
    fixture.detectChanges();

    expect(component.isConfirmationOpen).toBeFalse();
  });
});
