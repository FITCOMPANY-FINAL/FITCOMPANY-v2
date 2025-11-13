import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router'; // 👈 AÑADIDO
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink], // 👈 AÑADIDO
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  hide = true;
  saving = false;

  okMsg = '';
  errorMsg = '';

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  private autoHideMessages(ms = 4000) {
    window.setTimeout(() => {
      this.okMsg = '';
      this.errorMsg = '';
    }, ms);
  }

  submit() {
    if (this.form.invalid || this.saving) return;

    this.saving = true;
    this.okMsg = '';
    this.errorMsg = '';

    const body = {
      correo: this.form.value.email,
      password: this.form.value.password,
    };

    this.auth.login(body as any).subscribe({
      next: (res) => {
        this.auth.saveToken(res.token);
        this.router.navigate(['/dashboard'], { replaceUrl: true }); // opcionalmente replaceUrl
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Error al iniciar sesión';
        this.saving = false;
        this.autoHideMessages();
      },
    });
  }
}
