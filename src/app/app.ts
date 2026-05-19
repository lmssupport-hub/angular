import { Component } from '@angular/core';
import { Auth } from './auth/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Auth],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

}