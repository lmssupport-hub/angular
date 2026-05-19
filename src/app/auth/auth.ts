import { Component } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  registerData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: ''
};

  constructor(private apiService: ApiService) {}

  setLogin(state: boolean) {
    setTimeout(() => {
      this.isLogin = state;
    }, 80);
  }

  registerUser() {

    if (this.registerData.password !== this.registerData.confirmPassword) {
      alert('Password mismatch');
      return;
    }

    const payload = {
  firstName: this.registerData.firstName,
  lastName: this.registerData.lastName,
  email: this.registerData.email,
  phoneNumber: this.registerData.phone,
  password: this.registerData.password,
  termsAccepted: true
  
};

    this.apiService.registerUser(payload)
      .subscribe({
        next: (res) => {
          console.log('Register Success', res);
          alert('User Registered Successfully');
         
        },
        error: (err) => {
          console.log(err);
          alert('Registration Failed');
        }
      });
       console.log(payload);

  }

}