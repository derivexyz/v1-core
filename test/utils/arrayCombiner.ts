export function combineArrays(array_of_arrays: any[][]) {
  // First, handle some degenerate cases...

  if (!array_of_arrays) {
    // Or maybe we should toss an exception...?
    return [];
  }

  if (!Array.isArray(array_of_arrays)) {
    // Or maybe we should toss an exception...?
    return [];
  }

  if (array_of_arrays.length == 0) {
    return [];
  }

  for (let i = 0; i < array_of_arrays.length; i++) {
    if (!Array.isArray(array_of_arrays[i]) || array_of_arrays[i].length == 0) {
      // If any of the arrays in array_of_arrays are not arrays or zero-length, return an empty array...
      return [];
    }
  }

  // Done with degenerate cases...

  // Start "odometer" with a 0 for each array in array_of_arrays.
  const odometer = new Array(array_of_arrays.length);
  odometer.fill(0);

  const output = [];

  let newCombination = formCombination(odometer, array_of_arrays);

  output.push(newCombination);

  while (odometer_increment(odometer, array_of_arrays)) {
    newCombination = formCombination(odometer, array_of_arrays);
    output.push(newCombination);
  }

  return output;
} /* combineArrays() */

// Translate "odometer" to combinations from array_of_arrays
function formCombination(odometer: any, array_of_arrays: any[][]) {
  // In Imperative Programmingese (i.e., English):
  // let s_output = "";
  // for( let i=0; i < odometer.length; i++ ){
  //    s_output += "" + array_of_arrays[i][odometer[i]];
  // }
  // return s_output;

  // In Functional Programmingese (Henny Youngman one-liner):
  return odometer.reduce(function (accumulator: any, odometer_value: any, odometer_index: any) {
    return [...accumulator, array_of_arrays[odometer_index][odometer_value]];
  }, []);
} /* formCombination() */

function odometer_increment(odometer: any, array_of_arrays: any[][]) {
  // Basically, work you way from the rightmost digit of the "odometer"...
  // if you're able to increment without cycling that digit back to zero,
  // you're all done, otherwise, cycle that digit to zero and go one digit to the
  // left, and begin again until you're able to increment a digit
  // without cycling it...simple, huh...?

  for (let i_odometer_digit = odometer.length - 1; i_odometer_digit >= 0; i_odometer_digit--) {
    const maxee = array_of_arrays[i_odometer_digit].length - 1;

    if (odometer[i_odometer_digit] + 1 <= maxee) {
      // increment, and you're done...
      odometer[i_odometer_digit]++;
      return true;
    } else {
      if (i_odometer_digit - 1 < 0) {
        // No more digits left to increment, end of the line...
        return false;
      } else {
        // Can't increment this digit, cycle it to zero and continue
        // the loop to go over to the next digit...
        odometer[i_odometer_digit] = 0;
        continue;
      }
    }
  } /* for( let odometer_digit = odometer.length-1; odometer_digit >=0; odometer_digit-- ) */
} /* odometer_increment() */
