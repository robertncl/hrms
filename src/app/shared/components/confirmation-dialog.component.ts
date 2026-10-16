import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { enableLightDismissFallback } from '../functions/light-dismiss';

/** Modal confirmation. Opens as soon as it is rendered; the host removes it on close. */
@Component({
  selector: 'app-confirmation-dialog',
  template: `
    <dialog #dialog closedby="any" aria-labelledby="confirmation-title" aria-describedby="confirmation-message"
      (close)="onDialogClose()">
      <h2 id="confirmation-title">{{ title }}</h2>
      <p id="confirmation-message">{{ message }}</p>
      @if (note) {
        <p class="alert alert-info">{{ note }}</p>
      }
      <div class="dialog-actions">
        <button class="btn" (click)="cancel()">{{ cancelLabel }}</button>
        <button class="btn" [class.btn-danger]="destructive" [class.btn-primary]="!destructive" (click)="confirm()">
          {{ confirmLabel }}
        </button>
      </div>
    </dialog>
  `,
  standalone: true,
})
export class ConfirmationDialogComponent implements AfterViewInit {
  @Input() title = 'Please confirm';
  @Input() message = 'Are you sure you want to perform this action?';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  /** Optional context that helps the reader choose a safer path. */
  @Input() note = '';
  @Input() destructive = false;
  @Input() onConfirm?: () => void;
  @Input() onClose?: () => void;
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  isConfirmationOpen = true;

  ngAfterViewInit() {
    const dialog = this.dialog.nativeElement;
    enableLightDismissFallback(dialog);
    if (dialog.isConnected) {
      dialog.showModal();
    } else {
      dialog.open = true;
    }
  }

  cancel() {
    this.isConfirmationOpen = false;
    this.dialog.nativeElement.close();
  }

  confirm() {
    this.isConfirmationOpen = false;
    this.dialog.nativeElement.close();
    this.onConfirm?.();
  }

  onDialogClose() {
    this.isConfirmationOpen = false;
    this.onClose?.();
  }
}
