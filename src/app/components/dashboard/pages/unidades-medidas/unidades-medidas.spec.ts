import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnidadesMedidas } from './unidades-medidas';

describe('UnidadesMedidas', () => {
  let component: UnidadesMedidas;
  let fixture: ComponentFixture<UnidadesMedidas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnidadesMedidas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnidadesMedidas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
