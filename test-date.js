const st = new Date("2026-02-23T00:00:00-05:00");
console.log("react-day-picker (Mon 00:00 EST) => ", st.toISOString());

const startQuery = new Date("2026-02-23T12:00:00-05:00");
startQuery.setHours(0, 0, 0, 0);
console.log("query start (Mon 00:00 EST) => ", startQuery.toISOString());

console.log("Are they equal?", st.getTime() === startQuery.getTime());
