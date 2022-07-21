/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item: any) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

//   /**
//    * Deep merge two objects.
//    * @param target
//    * @param ...sources
//    */
//   export function mergeDeep(target: any, ...sources: any[]): any {
//     if (!sources.length) return target;
//     const source = sources.shift();

//     if (isObject(target) && isObject(source)) {
//       for (const key in source) {
//         if (isObject(source[key])) {
//           if (!target[key]) Object.assign(target, { [key]: {} });
//           mergeDeep(target[key], source[key]);
//         } else {
//           Object.assign(target, { [key]: source[key] });
//         }
//       }
//     }

//     return mergeDeep(target, ...sources);
//   }

export function mergeDeep(target: any, source: any) {
  let output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] });
        else output[key] = mergeDeep(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}
