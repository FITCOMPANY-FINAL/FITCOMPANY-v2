import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Perfiles } from './perfiles';

describe('Perfiles', () => {
  let component: Perfiles;
  let fixture: ComponentFixture<Perfiles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Perfiles]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Perfiles);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
