const networks: { [name: string]: number } = {
  mainnet: 1,
  rinkeby: 4,
  goerli: 5,
  kovan: 42,
}

export function getNetworkId(network: string): number {
  if (!networks[network]) {
    throw new Error(`Network ${network} not found`)
  }
  return networks[network]
}
