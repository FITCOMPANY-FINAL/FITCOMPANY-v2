import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Permisos } from './permisos';

describe('Permisos', () => {
  let component: Permisos;
  let fixture: ComponentFixture<Permisos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Permisos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Permisos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
