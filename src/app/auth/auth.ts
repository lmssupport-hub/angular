import { Component } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth {

  isLogin = true;

setLogin(state: boolean) {
  setTimeout(() => {
    this.isLogin = state;
  }, 80);
}

}