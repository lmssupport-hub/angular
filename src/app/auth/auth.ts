import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';

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
export class Auth {

  isLogin = true;

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

  constructor(
    private apiService: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

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
      email: '',
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

  validateLoginForm(): boolean {
    this.resetLoginErrors();

    let isValid = true;

    const email = this.loginData.email.trim();
    const password = this.loginData.password;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      this.loginErrors.email = 'Email is required';
      isValid = false;
    } else if (/\s/.test(this.loginData.email)) {
      this.loginErrors.email = 'Email should not have spaces';
      isValid = false;
    } else if (!emailRegex.test(email)) {
      this.loginErrors.email = 'Enter a valid email address';
      isValid = false;
    }

    if (!password) {
      this.loginErrors.password = 'Password is required';
      isValid = false;
    }

    return isValid;
  }

  loginUser() {
    this.loginSubmitted = true;

    if (!this.validateLoginForm()) {
      this.cdr.detectChanges();
      return;
    }

    const payload = {
      email: this.loginData.email.trim(),
      password: this.loginData.password
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

        this.resetLoginErrors();
        this.loginSubmitted = false;

        alert('Login Successfully');
        this.router.navigate(['/dashboard']);
      },

      error: (err) => {
        console.log('Login Error', err);

        this.resetLoginErrors();

        if (err.status === 404) {
          this.loginErrors.email = 'Email does not exist';
        } else if (err.status === 400 || err.status === 401) {
          this.loginErrors.password = 'Invalid Email or Password';
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

    const nameRegex = /^[A-Za-z]+$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]+$/;
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

    if (!firstName) {
      this.errorMessages.firstName = 'First Name is required';
      isValid = false;
      hasMandatoryError = true;
    } else if (!nameRegex.test(firstName)) {
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
    } else if (!nameRegex.test(lastName)) {
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
    } else if (!emailRegex.test(email)) {
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
    } else if (!phoneRegex.test(phone)) {
      this.errorMessages.phone = 'Enter a valid phone number';
      isValid = false;
    } else if (phone.length < 10 || phone.length > 15) {
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
    } else if (!strongPasswordRegex.test(password)) {
      this.errorMessages.password = 'Password must include uppercase, lowercase, number, and special character';
      isValid = false;
    } else if (email && password.toLowerCase() === email.toLowerCase()) {
      this.errorMessages.password = 'Password should not match Email ID';
      isValid = false;
    } else if (this.commonPasswords.includes(password.toLowerCase())) {
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

    this.apiService.registerUser(payload).subscribe({
      next: (res) => {
        console.log('Register Success', res);

        alert('User Registered Successfully');

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
        } else {
          this.errorMessages.email = 'Registration Failed';
        }

        this.cdr.detectChanges();
      }
    });
  }

}