# Lyra - Smart Contracts
## Documentation

[Documentation](https://docs.lyra.finance/implementation/lyra-protocol-architecture)

## Development

Run `yarn install` to install dependencies 

### To update API docs and UML diagram
```bash
$ yarn docgen
```

### To run unit tests

```bash
$ yarn compile
$ yarn test
```

### To run the scripts file:

```bash
$ yarn runScripts --network=mainnet-ovm 
```

This can also be run on `kovan-ovm` - though getting the blockNumbers will take very long. Modify the `scripts/runScripts.ts` file to adjust the scripts that are being run by changing the `RUN_PARAMS` object.