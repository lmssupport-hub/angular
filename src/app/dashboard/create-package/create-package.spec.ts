import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreatePackage } from './create-package';

describe('CreatePackage', () => {
  let component: CreatePackage;
  let fixture: ComponentFixture<CreatePackage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePackage],
    }).compileComponents();

    fixture = TestBed.createComponent(CreatePackage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
