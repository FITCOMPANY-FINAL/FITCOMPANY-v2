import { Component } from '@angular/core';
import { Navbar } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [Navbar],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {}
