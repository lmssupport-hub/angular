import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService  } from '../services/auth.service';
import { InviteService } from '../services/invite.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    FormsModule
  ],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth implements OnInit {

  isLogin = true;

  isLoading = false;


  loginSubmitted = false;
  registerSubmitted = false;

  showLoginPassword = false;
  showSignupPassword = false;
  showConfirmPassword = false;

  loginData = {
    email: '',
    password: '',
    remember: false
  };

  loginErrors: any = {
    email: '',
    password: ''
  };

  registerData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false
  };

  errorMessages: any = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    termsAccepted: ''
  };

  commonPasswords = [
    'password',
    'password123',
    '12345678',
    '123456789',
    'admin123',
    'qwerty123',
    'welcome123'
  ];

  // ── Invite-link registration ────────────────────────────────────────
  inviteToken: string | null = null;
  invitedRoleName: string | null = null;
  inviteCheckError = '';
  checkingInvite = false;

  constructor(
    private apiService: AuthService,
    private inviteService: InviteService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const token = params.get('invite');
      if (!token) return;

      this.inviteToken = token;
      this.isLogin = false; // an invite link always lands on the Sign Up side
      this.checkingInvite = true;

      this.inviteService.getInvite(token).subscribe({
        next: (info) => {
          this.registerData.email = info.email;
          this.invitedRoleName = info.roleName;
          this.checkingInvite = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.inviteCheckError = err?.error?.message ?? 'This invite link is invalid or has expired';
          this.checkingInvite = false;
          this.cdr.detectChanges();
        },
      });
    });
  }

  setLogin(state: boolean) {
    setTimeout(() => {
      this.isLogin = state;
    }, 80);
  }

  toggleLoginPassword() {
    this.showLoginPassword = !this.showLoginPassword;
  }

  toggleSignupPassword() {
    this.showSignupPassword = !this.showSignupPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  clearLoginError(field: string) {
    this.loginErrors[field] = '';
  }

  clearError(field: string) {
    this.errorMessages[field] = '';
  }

  resetLoginErrors() {
    this.loginErrors = {
      email: '',
      password: ''
    };
  }

  resetRegisterErrors() {
    this.errorMessages = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      termsAccepted: ''
    };
  }

  resetRegisterForm() {
    this.registerData = {
      firstName: '',
      lastName: '',
      email: this.inviteToken ? this.registerData.email : '', // keep the locked invite email
      phone: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false
    };

    this.resetRegisterErrors();
    this.registerSubmitted = false;
  }

  resetLoginForm() {
    this.loginData = {
      email: '',
      password: '',
      remember: false
    };

    this.resetLoginErrors();
    this.loginSubmitted = false;
  }

  goToForgotPassword() {
  this.router.navigate(['/Forgot-Password']);
}

  // ── Shared validation helpers ───────────────────────────────────────
  // Rejects consecutive dots anywhere in the address (e.g. 'gd.t01@vativahub..com',
  // 'priya@@example..com') in addition to the basic shape check.
  private emailRegex = /^(?!.*\.\.)[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Allows an optional leading '+' for international / country-code numbers
  // (e.g. '+919876543210', '+14155552671'). Digit-length is validated separately.
  private phoneRegex = /^\+?[0-9]+$/;

  private strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

  private nameRegex = /^[A-Za-z]+$/;

  // Normalizes away case and symbols before comparing against the common-password
  // list, so variants like 'Password@123' still match 'password123'.
  isCommonPassword(password: string): boolean {
    const normalized = password.toLowerCase().replace(/[^a-z0-9]/g, '');
    return this.commonPasswords.some(cp => normalized.includes(cp));
  }

  // NEW — drives [disabled] on the Login button (Login Button-02 / Autofill-01).
  // Only checks that both fields are non-empty after trimming — no format
  // validation here, that still happens on submit in validateLoginForm().
  isLoginFormValid(): boolean {
    return this.loginData.email.trim().length > 0 && this.loginData.password.trim().length > 0;
  }

  validateLoginForm(): boolean {
    this.resetLoginErrors();

    let isValid = true;
    let hasMandatoryError = false;

    // Leading/trailing spaces are stripped silently (Email ID-05 / Password-04);
    // only *internal* whitespace in the email is still flagged as an error.
    const email = this.loginData.email.trim();
    const password = this.loginData.password.trim();

    if (!email) {
      this.loginErrors.email = 'Email is required';
      isValid = false;
      hasMandatoryError = true;
    } else if (/\s/.test(email)) {
      this.loginErrors.email = 'Email should not have spaces';
      isValid = false;
    } else if (!this.emailRegex.test(email)) {
      this.loginErrors.email = 'Enter a valid email address';
      isValid = false;
    }

    if (!password) {
      this.loginErrors.password = 'Password is required';
      isValid = false;
      hasMandatoryError = true;
    }

    // Matches the register form's pattern (Login Button-03) — with the button
    // now disabled via isLoginFormValid(), this mainly guards programmatic calls.
    if (!isValid && hasMandatoryError) {
      alert('Please complete all mandatory fields.');
    }

    return isValid;
  }

  // NEW — Chrome/Safari fire an 'animationstart' event on autofilled inputs
  // (see the auth.css keyframe trick on .autofill-watch). Angular's zone.js
  // doesn't always pick up autofill via ngModel alone, so this forces a
  // change-detection pass the moment autofill happens (Autofill-01).
  onAutofillDetected(event: AnimationEvent) {
    if (event.animationName === 'onAutoFillStart') {
      this.cdr.detectChanges();
    }
  }

  loginUser() {
    this.loginSubmitted = true;

    if (!this.validateLoginForm()) {
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;

    const payload = {
      email: this.loginData.email.trim(),
      password: this.loginData.password.trim() // NEW — strip leading/trailing spaces (Password-04)
    };

    this.apiService.loginUser(payload).subscribe({
      next: (res: any) => {
        console.log('Login Success', res);

        localStorage.setItem('token', res.token);
        localStorage.setItem('loggedInUser', JSON.stringify(res.user));

        if (this.loginData.remember) {
          localStorage.setItem('userEmail', this.loginData.email.trim());
        } else {
          localStorage.removeItem('userEmail');
        }


fetch('http://localhost:8080/api/priority-ranking', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
})
  .then(r => r.json())
  .then(data => console.table(data));


        this.resetLoginErrors();
        this.loginSubmitted = false;

        // NEW — resolve screens/permissions before landing on dashboard
        this.apiService.getMyPermissions().subscribe({
          next: (perms) => {
            this.apiService.setStoredPermissions(perms);

            // NEW — Authentication access control: block sign-in if the
            // resolved package/role doesn't grant the 'auth' category.
            const hasAuthAccess = this.apiService.isSuperAdmin() || this.apiService.hasCategoryAccess('auth');
            if (!hasAuthAccess) {
              this.isLoading = false;
              this.apiService.logout();
              this.loginErrors.password = 'You do not have Authentication access. Contact your Super Admin.';
              this.cdr.detectChanges();
              return;
            }

            setTimeout(() => {
              this.isLoading = false;
              this.router.navigate(['/dashboard']);
            }, 3000);
          },
          error: () => {
            // permissions fetch failed — still let them in, sidebar will just show nothing extra
            setTimeout(() => {
              this.isLoading = false;
              this.router.navigate(['/dashboard']);
            }, 3000);
          }
        });
      },


      error: (err) => {
        this.isLoading = false;

        this.resetLoginErrors();

        if (err.status === 404) {
          this.loginErrors.email = 'Email does not exist';
        } else if (err.status === 400 || err.status === 401) {
          this.loginErrors.password = 'Invalid Email or Password';
        } else if (err.status === 403) {
          // NEW — no package/role assigned yet
          this.loginErrors.password = err.error?.message ?? 'Access not configured for your account yet.';
        } else if (err.status === 0) {
          this.loginErrors.password = 'Server not connected';
        } else {
          this.loginErrors.password = 'Login Failed';
        }

        this.cdr.detectChanges();
      }
    });
  }

  validateRegisterForm(): boolean {
    this.resetRegisterErrors();

    let isValid = true;
    let hasMandatoryError = false;

    const firstName = this.registerData.firstName.trim();
    const lastName = this.registerData.lastName.trim();
    const email = this.registerData.email.trim();
    const phone = this.registerData.phone.trim();
    const password = this.registerData.password;
    const confirmPassword = this.registerData.confirmPassword;
    const phoneDigitsOnly = phone.replace('+', '');

    if (!firstName) {
      this.errorMessages.firstName = 'First Name is required';
      isValid = false;
      hasMandatoryError = true;
    } else if (!this.nameRegex.test(firstName)) {
      this.errorMessages.firstName = 'First Name must contain only letters';
      isValid = false;
    } else if (firstName.length < 4) {
      this.errorMessages.firstName = 'First Name must be at least 4 characters';
      isValid = false;
    }

    if (!lastName) {
      this.errorMessages.lastName = 'Last Name is required';
      isValid = false;
      hasMandatoryError = true;
    } else if (!this.nameRegex.test(lastName)) {
      this.errorMessages.lastName = 'Last Name must contain only letters';
      isValid = false;
    }

    if (!email) {
      this.errorMessages.email = 'Email is required';
      isValid = false;
      hasMandatoryError = true;
    } else if (/\s/.test(this.registerData.email)) {
      this.errorMessages.email = 'Email should not have spaces';
      isValid = false;
    } else if (!this.emailRegex.test(email)) {
      this.errorMessages.email = 'Enter a valid email address';
      isValid = false;
    } else if (email.length > 254) {
      this.errorMessages.email = 'Email length exceeds limit';
      isValid = false;
    }

    if (!phone) {
      this.errorMessages.phone = 'Enter a valid phone number';
      isValid = false;
      hasMandatoryError = true;
    } else if (!this.phoneRegex.test(phone)) {
      this.errorMessages.phone = 'Enter a valid phone number';
      isValid = false;
    } else if (phoneDigitsOnly.length < 10 || phoneDigitsOnly.length > 15) {
      this.errorMessages.phone = 'Phone number must be between 10 and 15 digits';
      isValid = false;
    }

    if (!password) {
      this.errorMessages.password = 'Password is required.';
      isValid = false;
      hasMandatoryError = true;
    } else if (password.length < 8 || password.length > 16) {
      this.errorMessages.password = 'Password must be 8-16 characters';
      isValid = false;
    } else if (!this.strongPasswordRegex.test(password)) {
      this.errorMessages.password = 'Password must include uppercase, lowercase, number, and special character';
      isValid = false;
    } else if (email && password.toLowerCase() === email.toLowerCase()) {
      this.errorMessages.password = 'Password should not match Email ID';
      isValid = false;
    } else if (this.isCommonPassword(password)) {
      this.errorMessages.password = 'Password is too common';
      isValid = false;
    }

    if (!confirmPassword) {
      this.errorMessages.confirmPassword = 'Confirm Password is required';
      isValid = false;
      hasMandatoryError = true;
    } else if (password !== confirmPassword) {
      this.errorMessages.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    if (!this.registerData.termsAccepted) {
      this.errorMessages.termsAccepted = 'You must accept Terms & Conditions';
      isValid = false;
      hasMandatoryError = true;
    }

    if (!isValid) {
      alert(
        hasMandatoryError
          ? 'Please complete all mandatory fields.'
          : 'Please fix validation errors before submitting'
      );
    }

    return isValid;
  }

  // NEW — drives [disabled] on the Sign Up button so it only becomes clickable
  // once every mandatory field is valid AND Terms & Conditions is checked
  // (Test Case Sign Up Button_04). Mirrors the same rules as validateRegisterForm(),
  // but silently (no alerts) since it re-evaluates on every keystroke.
  isRegisterFormValid(): boolean {
    const { firstName, lastName, email, phone, password, confirmPassword, termsAccepted } = this.registerData;

    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    const ph = phone.trim();
    const phDigits = ph.replace('+', '');

    return !!(
      fn.length >= 4 && this.nameRegex.test(fn) &&
      ln.length > 0 && this.nameRegex.test(ln) &&
      em.length > 0 && em.length <= 254 && this.emailRegex.test(em) &&
      ph.length > 0 && this.phoneRegex.test(ph) && phDigits.length >= 10 && phDigits.length <= 15 &&
      password.length >= 8 && password.length <= 16 &&
      this.strongPasswordRegex.test(password) &&
      password.toLowerCase() !== em.toLowerCase() &&
      !this.isCommonPassword(password) &&
      confirmPassword === password &&
      termsAccepted
    );
  }

  registerUser() {
    this.registerSubmitted = true;

    if (!this.validateRegisterForm()) {
      this.cdr.detectChanges();
      return;
    }

    const payload = {
      firstName: this.registerData.firstName.trim(),
      lastName: this.registerData.lastName.trim(),
      email: this.registerData.email.trim(),
      phoneNumber: this.registerData.phone.trim(),
      password: this.registerData.password,
      termsAccepted: this.registerData.termsAccepted
    };

    // inviteToken (if present) tells the backend: stamp createdByAdminId + assignedRoleId
    // from the invite, and mark the invite used.
    this.apiService.registerUser(payload, this.inviteToken).subscribe({
      next: (res) => {

        alert(this.inviteToken ? 'Account created — you can now log in' : 'User Registered Successfully');

        this.resetRegisterForm();
        this.isLogin = true;
      },

      error: (err) => {
        console.log('Register Error', err);

        this.resetRegisterErrors();

        if (
          err.status === 409 ||
          err.error?.message?.toLowerCase().includes('email') ||
          err.error?.message?.toLowerCase().includes('duplicate')
        ) {
          this.errorMessages.email = 'Email already exists';
        } else if (err.status === 0) {
          this.errorMessages.email = 'Server not connected';
        } else if (err.error?.message) {
          this.errorMessages.email = err.error.message;
        } else {
          this.errorMessages.email = 'Registration Failed';
        }

        this.cdr.detectChanges();
      }
    });
  }

}