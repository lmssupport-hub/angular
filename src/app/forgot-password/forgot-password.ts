import { Component, OnDestroy,ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';


type Step = 'forgot' | 'reset' | 'success';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword implements OnDestroy {

  step: Step = 'forgot';

  // ── Config (mirrors the TBD thresholds in the validation spec) ──────────
  readonly otpLength = 4;                 // spec: 4–6 digits, TBD
  readonly resendCooldownSeconds = 300;    // spec: "after configured timer completion", TBD
  readonly maxResendAttempts = 3;         // spec: e.g. 3 resend attempts, TBD

  // ── Step 1 state: Email + OTP ────────────────────────────────────────────
  email = '';
  otpDigits: string[] = Array(this.otpLength).fill('');
  otpSent = false;
  resendTimer = 0;
  resendAttempts = 0;
  private timerHandle: any;

  // ── Step 2 state: New Password ───────────────────────────────────────────
  resetToken = '';
  newPassword = '';
  confirmPassword = '';
  showNewPassword = false;
  showConfirmPassword = false;

  errors: any = {
    email: '',
    otp: '',
    password: '',
    confirmPassword: ''
  };

  constructor(
    private apiService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy() {
    if (this.timerHandle) clearInterval(this.timerHandle);
  }

  // ── Derived enable/disable state for buttons ─────────────────────────────

  get canSendOtp(): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const email = this.email.trim();
  return emailRegex.test(email) && email.length <= 254 && !(this.otpSent && this.resendTimer > 0);
}

  get isOtpComplete(): boolean {
    return this.otpDigits.length === this.otpLength && this.otpDigits.every(d => d.trim().length === 1);
  }

  get canVerifyOtp(): boolean {
    return this.isOtpComplete;
  }

  get canResend(): boolean {
    return this.resendTimer === 0 && this.resendAttempts < this.maxResendAttempts;
  }

  get canSubmitPassword(): boolean {
    return this.newPassword.length > 0 && this.confirmPassword.length > 0;
  }

  get resendTimerDisplay(): string {
  const m = Math.floor(this.resendTimer / 60);
  const s = this.resendTimer % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

  clearError(field: string) {
    this.errors[field] = '';
  }

  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // ── Step 1a: Send / Resend OTP ────────────────────────────────────────────

  private validateEmailFormat(email: string): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Please enter Email ID';
    if (email.length > 254) return 'Enter a valid email address';
    if (!emailRegex.test(email)) return 'Enter a valid email address';
    return '';
  }

  sendOtp(isResend = false) {
    this.errors.email = '';
    this.errors.otp = '';

    // ✅ spec: Resend OTP allowed only after timer completion + capped attempts
    if (isResend && !this.canResend) {
      this.errors.otp = this.resendAttempts >= this.maxResendAttempts
        ? 'Maximum resend attempts reached. Please try again later.'
        : 'Please wait for the timer to complete before resending';
      return;
    }

    // ✅ spec: "System should automatically trim leading and trailing spaces"
    const email = this.email.trim();
    const formatError = this.validateEmailFormat(email);
    if (formatError) {
      this.errors.email = isResend ? 'Email is required' : formatError;
      return;
    }
    this.email = email;



    this.otpSent = true;
this.otpDigits = Array(this.otpLength).fill('');
this.errors.otp = '';
if (isResend) this.resendAttempts++;
this.startResendTimer(this.resendCooldownSeconds);

this.apiService.forgotPassword({ email: email.toLowerCase() }).subscribe({
  next: () => { /* OTP sent — field already visible, nothing extra needed */ },
  error: (err) => {
    // ✅ Roll back optimistic state on failure
    if (!isResend) this.otpSent = false;
    this.resendTimer = 0;
    if (this.timerHandle) clearInterval(this.timerHandle);
    if (isResend) this.resendAttempts--;

    if (err.status === 404) {
      this.errors.email = 'Email ID not registered';
    } else if (err.status === 429) {
      this.errors.otp = err.error?.message || 'Maximum resend attempts reached. Please try again later.';
    } else if (err.status === 0) {
      this.errors.email = 'Server not connected';
    } else {
      this.errors.email = 'Failed to send OTP. Please try again.';
    }
  }
});
  }

  resendOtp() {
    this.sendOtp(true);
  }

  private startResendTimer(seconds: number) {
    this.resendTimer = seconds;
    if (this.timerHandle) clearInterval(this.timerHandle);

    this.timerHandle = setInterval(() => {
      this.resendTimer--;
      if (this.resendTimer <= 0) {
        clearInterval(this.timerHandle);
        this.resendTimer = 0;
      }
    }, 1000);
  }

  // ── Step 1b: OTP input + Verify OTP ───────────────────────────────────────

  onOtpInput(event: Event, index: number) {
  const input = event.target as HTMLInputElement;
  const digit = input.value.replace(/[^0-9]/g, '').slice(-1);

  // ✅ Clear all digits first to prevent carry-over
  input.value = digit;
  this.otpDigits = [...this.otpDigits]; // force new array
  this.otpDigits[index] = digit;
  this.cdr.detectChanges();
  this.errors.otp = '';

  if (digit && index < this.otpLength - 1) {
    const inputs = input.parentElement?.querySelectorAll('input');
    (inputs?.[index + 1] as HTMLInputElement)?.focus();
  }
}

onOtpKeydown(event: KeyboardEvent, index: number) {
  const input = event.target as HTMLInputElement;

  if (event.key === 'Backspace') {
    event.preventDefault();
    if (this.otpDigits[index]) {
      this.otpDigits[index] = '';
      input.value = '';
    } else if (index > 0) {
      const inputs = input.parentElement?.querySelectorAll('input');
      const prev = inputs?.[index - 1] as HTMLInputElement;
      if (prev) {
        this.otpDigits[index - 1] = '';
        prev.value = '';
        prev.focus();
      }
    }
  }
}

trackByIndex(index: number): number {
  return index;
}

  verifyOtp() {
    this.errors.otp = '';

    const otp = this.otpDigits.join('').trim();
    if (!otp) {
      this.errors.otp = 'OTP is required';
      return;
    }
    if (!this.isOtpComplete) {
      this.errors.otp = 'Please enter valid OTP';
      return;
    }

    this.apiService.verifyOtp({ email: this.email.trim().toLowerCase(), otp }).subscribe({
      next: (res: any) => {
        this.resetToken = res.resetToken;
        this.step = 'reset';
      },
      error: (err) => {
        this.errors.otp = err.error?.message || 'Invalid OTP';
      }
    });
  }

  // ── Step 2: New Password / Confirm Password / Reset ─────────────────────

  submitNewPassword() {
    this.errors.password = '';
    this.errors.confirmPassword = '';

    if (!this.newPassword || !this.confirmPassword) {
      alert('Please complete all mandatory fields');
      if (!this.newPassword) this.errors.password = 'New Password is required';
      if (!this.confirmPassword) this.errors.confirmPassword = 'Confirm Password is required';
      return;
    }

    // ✅ spec: 8–16 chars, upper+lower+digit+special character, no spaces allowed
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,16}$/;
    if (/\s/.test(this.newPassword) || !strongPasswordRegex.test(this.newPassword)) {
      this.errors.password = 'Password does not meet password policy requirements';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errors.confirmPassword = 'Password does not match';
      return;
    }

    this.apiService.resetPassword({
      resetToken: this.resetToken,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: () => {
        this.step = 'success';
      },
      error: (err) => {
        this.errors.password = err.error?.message || 'Reset failed. Please try again.';
      }
    });
  }

  goToLogin(event: Event) {
    event.preventDefault();
    this.router.navigate(['/auth']);
  }
}
