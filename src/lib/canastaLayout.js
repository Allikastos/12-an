export function seatTemplateList(total, isMobile) {
  const desktop = {
    1: [{ top: "92%", left: "50%", angle: 0 }],
    2: [
      { top: "92%", left: "50%", angle: 0 },
      { top: "9%", left: "50%", angle: 0 },
    ],
    3: [
      { top: "92%", left: "50%", angle: 0 },
      { top: "14%", left: "24%", angle: 7 },
      { top: "14%", left: "76%", angle: -7 },
    ],
    4: [
      { top: "92%", left: "50%", angle: 0 },
      { top: "9%", left: "50%", angle: 0 },
      { top: "34%", left: "90%", angle: -9 },
      { top: "34%", left: "10%", angle: 9 },
    ],
    5: [
      { top: "92%", left: "50%", angle: 0 },
      { top: "10%", left: "50%", angle: 0 },
      { top: "20%", left: "82%", angle: -8 },
      { top: "52%", left: "86%", angle: -10 },
      { top: "52%", left: "14%", angle: 10 },
    ],
    6: [
      { top: "92%", left: "50%", angle: 0 },
      { top: "10%", left: "50%", angle: 0 },
      { top: "20%", left: "82%", angle: -8 },
      { top: "50%", left: "88%", angle: -11 },
      { top: "50%", left: "12%", angle: 11 },
      { top: "20%", left: "18%", angle: 8 },
    ],
  };

  const mobile = {
    1: [{ top: "90%", left: "50%", angle: 0 }],
    2: [
      { top: "90%", left: "50%", angle: 0 },
      { top: "12%", left: "50%", angle: 0 },
    ],
    3: [
      { top: "90%", left: "50%", angle: 0 },
      { top: "12%", left: "50%", angle: 0 },
      { top: "46%", left: "90%", angle: 0 },
    ],
    4: [
      { top: "90%", left: "50%", angle: 0 },
      { top: "12%", left: "50%", angle: 0 },
      { top: "46%", left: "90%", angle: 0 },
      { top: "46%", left: "14%", angle: 0 },
    ],
    5: [
      { top: "90%", left: "50%", angle: 0 },
      { top: "12%", left: "50%", angle: 0 },
      { top: "30%", left: "90%", angle: 0 },
      { top: "62%", left: "90%", angle: 0 },
      { top: "46%", left: "14%", angle: 0 },
    ],
    6: [
      { top: "90%", left: "50%", angle: 0 },
      { top: "12%", left: "50%", angle: 0 },
      { top: "24%", left: "90%", angle: 0 },
      { top: "58%", left: "90%", angle: 0 },
      { top: "58%", left: "14%", angle: 0 },
      { top: "24%", left: "14%", angle: 0 },
    ],
  };

  return (isMobile ? mobile : desktop)[total] ?? [{ top: "50%", left: "50%", angle: 0 }];
}
