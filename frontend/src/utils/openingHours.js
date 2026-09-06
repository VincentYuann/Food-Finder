/**
 * Evaluates whether a restaurant is currently open based on its weekly opening hours schedule.
 * 
 * Correctly accounts for:
 * 1. Shifts that crossed midnight from yesterday into the early hours of today (e.g. Saturday 12:00 PM - 3:00 AM on Sunday morning).
 * 2. Shifts starting today that cross midnight into tomorrow morning.
 * 3. Regular daytime shifts and split shifts (e.g. lunch and dinner).
 * 4. 24-hour and explicitly closed days.
 * 
 * @param {string[]} openingHoursArray - Array of strings (e.g., ["Monday: 12:00 PM – 12:00 AM", ...])
 * @param {Date} [testDate=new Date()] - Date object to test against (defaults to now)
 * @returns {boolean|null} true if open, false if closed, null if hours are not provided
 */
export function checkIfOpen(openingHoursArray, testDate = new Date()) {
  const status = getOperatingStatus(openingHoursArray, testDate);
  return status.isOpen;
}

/**
 * Returns detailed, structured operating status including active overnight shift info,
 * preventing confusing UI discrepancies where a midnight-crossing shift (e.g. Saturday night until 3 AM)
 * displays "Sunday Today: Closed" while the restaurant is actively open.
 * 
 * @param {string[]} openingHoursArray - Array of strings (e.g., ["Monday: 12:00 PM – 12:00 AM", ...])
 * @param {Date} [testDate=new Date()] - Date object to test against (defaults to now)
 * @returns {{
 *   isOpen: boolean|null,
 *   isOvernightFromYesterday: boolean,
 *   activeShiftName: string|null,
 *   activeShiftEndStr: string|null,
 *   activeShiftSummary: string|null,
 *   todayDayName: string,
 *   todayHoursStr: string|null,
 * }}
 */
export function getOperatingStatus(openingHoursArray, testDate = new Date()) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayIdx = testDate.getDay();
  const todayName = days[todayIdx];
  const yesterdayIdx = (todayIdx + 6) % 7;
  const yesterdayName = days[yesterdayIdx];

  const defaultResult = {
    isOpen: null,
    isOvernightFromYesterday: false,
    activeShiftName: null,
    activeShiftEndStr: null,
    activeShiftSummary: null,
    todayDayName: todayName,
    todayHoursStr: null,
  };

  if (!Array.isArray(openingHoursArray) || openingHoursArray.length === 0) {
    return defaultResult;
  }

  const todayEntry = openingHoursArray.find((str) => str.startsWith(todayName));
  const todayHoursStr = todayEntry
    ? todayEntry.substring(todayEntry.indexOf(':') + 1).trim()
    : null;

  const currentMinutes = testDate.getHours() * 60 + testDate.getMinutes();

  const parseTime = (timeStr, isEnd = false) => {
    const match = timeStr.match(/(\d+)(?::(\d+))?\s*(AM|PM)?/i);
    if (!match) return -1;
    let hours = parseInt(match[1], 10);
    const mins = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3] ? match[3].toUpperCase() : null;

    if (meridiem === 'AM') {
      if (hours === 12) hours = isEnd ? 24 : 0;
    } else if (meridiem === 'PM') {
      if (hours < 12) hours += 12;
    }
    return hours * 60 + mins;
  };

  const parseRanges = (dayEntryStr) => {
    if (!dayEntryStr) return [];
    const hoursPart = dayEntryStr.substring(dayEntryStr.indexOf(':') + 1).trim();
    if (hoursPart === 'Closed') return 'closed';
    if (hoursPart === 'Open 24 hours') return '24h';

    return hoursPart
      .split(',')
      .map((s) => s.trim())
      .map((range) => {
        const parts = range.split(/[\u2013\u2014\-]/).map((s) => s.trim());
        if (parts.length !== 2) return null;
        let startMins = parseTime(parts[0], false);
        let endMins = parseTime(parts[1], true);

        // Implied PM handling (e.g. "11:00 - 2:00 PM" where start is 11:00 AM)
        if (
          startMins !== -1 &&
          endMins !== -1 &&
          !parts[0].toLowerCase().includes('m') &&
          parts[1].toLowerCase().includes('m')
        ) {
          if (parts[1].toLowerCase().includes('pm') && startMins < 720 && startMins + 720 < endMins) {
            startMins += 720;
          }
        }
        return { startMins, endMins, rawEnd: parts[1] };
      })
      .filter(Boolean);
  };

  // 1. Check if we are still within yesterday's overnight shift (e.g. Saturday night running into Sunday 3 AM)
  const yesterdayStr = openingHoursArray.find((str) => str.startsWith(yesterdayName));
  const yesterdayRanges = parseRanges(yesterdayStr);
  if (Array.isArray(yesterdayRanges)) {
    for (const { startMins, endMins, rawEnd } of yesterdayRanges) {
      // Overnight shift: endMins < startMins (e.g. 180 < 720)
      if (endMins < startMins && currentMinutes < endMins) {
        return {
          isOpen: true,
          isOvernightFromYesterday: true,
          activeShiftName: yesterdayName,
          activeShiftEndStr: rawEnd,
          activeShiftSummary: `Open until ${rawEnd} (${yesterdayName.slice(0, 3)} night shift)`,
          todayDayName: todayName,
          todayHoursStr,
        };
      }
    }
  }

  // 2. Check today's shift
  const todayRanges = parseRanges(todayEntry);
  if (todayRanges === '24h') {
    return {
      isOpen: true,
      isOvernightFromYesterday: false,
      activeShiftName: todayName,
      activeShiftEndStr: null,
      activeShiftSummary: 'Open 24 hours',
      todayDayName: todayName,
      todayHoursStr,
    };
  }

  if (todayRanges === 'closed' || !Array.isArray(todayRanges)) {
    return {
      isOpen: false,
      isOvernightFromYesterday: false,
      activeShiftName: null,
      activeShiftEndStr: null,
      activeShiftSummary: null,
      todayDayName: todayName,
      todayHoursStr: 'Closed',
    };
  }

  for (const { startMins, endMins, rawEnd } of todayRanges) {
    if (endMins < startMins) {
      // Starts today, crosses past midnight
      if (currentMinutes >= startMins) {
        return {
          isOpen: true,
          isOvernightFromYesterday: false,
          activeShiftName: todayName,
          activeShiftEndStr: rawEnd,
          activeShiftSummary: `Open until ${rawEnd}`,
          todayDayName: todayName,
          todayHoursStr,
        };
      }
    } else {
      // Standard same-day range
      if (currentMinutes >= startMins && currentMinutes < endMins) {
        return {
          isOpen: true,
          isOvernightFromYesterday: false,
          activeShiftName: todayName,
          activeShiftEndStr: rawEnd,
          activeShiftSummary: `Open until ${rawEnd}`,
          todayDayName: todayName,
          todayHoursStr,
        };
      }
    }
  }

  return {
    isOpen: false,
    isOvernightFromYesterday: false,
    activeShiftName: null,
    activeShiftEndStr: null,
    activeShiftSummary: null,
    todayDayName: todayName,
    todayHoursStr,
  };
}
