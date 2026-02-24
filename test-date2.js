const st = new Date("2026-02-24T00:00:00-05:00");
const stMon = new Date(st);
const dayOfWeek = stMon.getDay();
const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
stMon.setDate(stMon.getDate() + diff);
console.log("Tuesday to Monday =>", stMon.toISOString());
