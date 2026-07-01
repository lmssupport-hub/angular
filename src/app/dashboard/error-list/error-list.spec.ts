import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorList } from './error-list';

describe('ErrorList', () => {
  let component: ErrorList;
  let fixture: ComponentFixture<ErrorList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorList],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
