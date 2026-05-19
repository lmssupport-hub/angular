import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  baseUrl = 'http://localhost:8080/api/users';

  constructor(private http: HttpClient) {}

  registerUser(data: any) {
    return this.http.post(
      `${this.baseUrl}/register`,
      data
    );
  }

}