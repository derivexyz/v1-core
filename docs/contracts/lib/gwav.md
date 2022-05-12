# `GWAV`

Instances of stored oracle data, "observations", are collected in the oracle array

The GWAV values are calculated from the blockTimestamps and "q" accumulator values of two Observations. When

requested the closest observations are scaled to the requested timestamp.

## Functions:

- `_initialize(struct GWAV.Params self, uint256 newVal, uint256 blockTimestamp) (internal)`

- `_write(struct GWAV.Params self, uint256 nextVal, uint256 blockTimestamp) (internal)`

- `getGWAVForPeriod(struct GWAV.Params self, uint256 secondsAgoA, uint256 secondsAgoB) (public)`

- `observe(struct GWAV.Params self, uint256 currentBlockTimestamp, uint256[] secondsAgos) (public)`

- `queryFirstBefore(struct GWAV.Params self, uint256 currentBlockTimestamp, uint256 secondsAgo) (internal)`

- `queryFirstBeforeAndScale(struct GWAV.Params self, uint256 currentBlockTimestamp, uint256 secondsAgo) (internal)`

- `_binarySearch(struct GWAV.Params self, uint256 target) (internal)`

- `_initializeWithManualQ(struct GWAV.Params self, int256 qVal, uint256 nextVal, uint256 blockTimestamp) (internal)`

### Function `_initialize(struct GWAV.Params self, uint256 newVal, uint256 blockTimestamp) internal`

Initialize the oracle array by writing the first Observation.

Called once for the lifecycle of the observations array

First Observation uses blockTimestamp as the time interval to prevent manipulation of the GWAV immediately

after initialization

#### Parameters:

- `self`: Stores past Observations and the index of the latest Observation

- `newVal`: First observed value for blockTimestamp

- `blockTimestamp`: Timestamp of first Observation

### Function `_write(struct GWAV.Params self, uint256 nextVal, uint256 blockTimestamp) internal`

Writes an oracle Observation to the GWAV array

Writable at most once per block. BlockTimestamp must be > last.blockTimestamp

#### Parameters:

- `self`: Stores past Observations and the index of the latest Observation

- `nextVal`: Value at given blockTimestamp

- `blockTimestamp`: Current blockTimestamp

### Function `getGWAVForPeriod(struct GWAV.Params self, uint256 secondsAgoA, uint256 secondsAgoB) → uint256 public`

Calculates the geometric moving average between two Observations A & B. These observations are scaled to

the requested timestamps

For the current GWAV value, "0" may be passed in for secondsAgo

If timestamps A==B, returns the value at A/B.

#### Parameters:

- `self`: Stores past Observations and the index of the latest Observation

- `secondsAgoA`: Seconds from blockTimestamp to Observation A

- `secondsAgoB`: Seconds from blockTimestamp to Observation B

### Function `observe(struct GWAV.Params self, uint256 currentBlockTimestamp, uint256[] secondsAgos) → int256[] qCumulatives, uint256[] timestamps public`

Returns the GWAV accumulator/timestamps values for each "secondsAgo" in the array `secondsAgos[]`

#### Parameters:

- `currentBlockTimestamp`: Timestamp of current block

- `secondsAgos`: Array of all timestamps for which to export accumulator/timestamp values

### Function `queryFirstBefore(struct GWAV.Params self, uint256 currentBlockTimestamp, uint256 secondsAgo) → int256 qCumulative, uint256 timestamp internal`

Finds the first observation before a timestamp "secondsAgo" from the "currentBlockTimestamp"

If target falls between two Observations, the older one is returned

See _queryFirstBefore() for edge cases where target lands

after the newest Observation or before the oldest Observation

Reverts if secondsAgo exceeds the currentBlockTimestamp

#### Parameters:

- `self`: Stores past Observations and the index of the latest Observation

- `currentBlockTimestamp`: Timestamp of current block

- `secondsAgo`: Seconds from currentBlockTimestamp to target Observation

### Function `queryFirstBeforeAndScale(struct GWAV.Params self, uint256 currentBlockTimestamp, uint256 secondsAgo) → int256 qCumulative, uint256 timestamp internal`

### Function `_binarySearch(struct GWAV.Params self, uint256 target) → uint256 internal`

Finds closest Observation before target using binary search and returns its index

Used when the target is located within the stored observation boundaries

e.g. Older than the most recent observation and younger, or the same age as, the oldest observation

#### Parameters:

- `self`: Stores past Observations and the index of the latest Observation

- `target`: BlockTimestamp of target Observation

#### Return Values:

- foundIndex Returns the Observation which is older than target (instead of newer)

### Function `_initializeWithManualQ(struct GWAV.Params self, int256 qVal, uint256 nextVal, uint256 blockTimestamp) internal`

Creates the first Observation with manual Q accumulator value.

#### Parameters:

- `qVal`: Initial GWAV accumulator value

- `nextVal`: First observed value for blockTimestamp

- `blockTimestamp`: Timestamp of Observation
