# `Address`

Collection of functions related to the address type

## Functions:

- `isContract(address account) (internal)`

- `functionCall(address target, bytes data) (internal)`

- `functionCall(address target, bytes data, string errorMessage) (internal)`

- `functionCallWithoutValue(address target, bytes data) (internal)`

- `functionCallWithoutValue(address target, bytes data, string errorMessage) (internal)`

- `functionStaticCall(address target, bytes data) (internal)`

- `functionStaticCall(address target, bytes data, string errorMessage) (internal)`

- `functionDelegateCall(address target, bytes data) (internal)`

- `functionDelegateCall(address target, bytes data, string errorMessage) (internal)`

### Function `isContract(address account) → bool internal`

Returns true if `account` is a contract.

[IMPORTANT]

====

It is unsafe to assume that an address for which this function returns

false is an externally-owned account (EOA) and not a contract.

Among others, `isContract` will return false for the following

types of addresses:

 - an externally-owned account

 - a contract in construction

 - an address where a contract will be created

 - an address where a contract lived, but was destroyed

====

### Function `functionCall(address target, bytes data) → bytes internal`

Performs a Solidity function call using a low level `call`. A

plain`call` is an unsafe replacement for a function call: use this

function instead.

If `target` reverts with a revert reason, it is bubbled up by this

function (like regular Solidity function calls).

Returns the raw returned data. To convert to the expected return value,

use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].

Requirements:

- `target` must be a contract.

- calling `target` with `data` must not revert.

_Available since v3.1._

### Function `functionCall(address target, bytes data, string errorMessage) → bytes internal`

Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with

`errorMessage` as a fallback revert reason when `target` reverts.

_Available since v3.1._

### Function `functionCallWithoutValue(address target, bytes data) → bytes internal`

Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],

but also transferring `value` wei to `target`.

Requirements:

- the calling contract must have an ETH balance of at least `value`.

- the called Solidity function must be `payable`.

_Available since v3.1._

### Function `functionCallWithoutValue(address target, bytes data, string errorMessage) → bytes internal`

Same as {xref-Address-functionCallWithoutValue-address-bytes-uint256-}[`functionCallWithoutValue`], but

with `errorMessage` as a fallback revert reason when `target` reverts.

_Available since v3.1._

### Function `functionStaticCall(address target, bytes data) → bytes internal`

Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],

but performing a static call.

_Available since v3.3._

### Function `functionStaticCall(address target, bytes data, string errorMessage) → bytes internal`

Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],

but performing a static call.

_Available since v3.3._

### Function `functionDelegateCall(address target, bytes data) → bytes internal`

Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],

but performing a delegate call.

_Available since v3.4._

### Function `functionDelegateCall(address target, bytes data, string errorMessage) → bytes internal`

Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],

but performing a delegate call.

_Available since v3.4._
