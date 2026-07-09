import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OurCircle } from './our-circle';

describe('OurCircle', () => {
  let component: OurCircle;
  let fixture: ComponentFixture<OurCircle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OurCircle],
    }).compileComponents();

    fixture = TestBed.createComponent(OurCircle);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
