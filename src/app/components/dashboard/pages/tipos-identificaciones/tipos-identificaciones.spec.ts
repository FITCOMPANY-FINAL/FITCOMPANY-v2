import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TiposIdentificaciones } from './tipos-identificaciones';

describe('TiposIdentificaciones', () => {
  let fixture: ComponentFixture<TiposIdentificaciones>;
  let component: TiposIdentificaciones;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TiposIdentificaciones],
    }).compileComponents();

    fixture = TestBed.createComponent(TiposIdentificaciones);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crearse', () => {
    expect(component).toBeTruthy();
  });
});
