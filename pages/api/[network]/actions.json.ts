import { NextApiRequest, NextApiResponse } from 'next'
import { toChecksumAddress } from 'ethereum-checksum-address'
import { gqlQuery } from 'lib/graph'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*")

  const data = await gqlQuery(req.query.network as string, `
    query {
      adapters {
        id
        protocol
        outputWrapper {
          id
          underlyingName
          underlyingSymbol
          poolTokenSymbols
          poolTokenNames
        }
      }
    }`)

  const uniswapAdapters = data.adapters
    .filter((adapter: any) => adapter.protocol === 'Uniswap' && !adapter.outputWrapper.poolTokenSymbols)
    .map((adapter: any) => ({
      address: toChecksumAddress(adapter.id),
      outputWrapper: toChecksumAddress(adapter.outputWrapper.id),
      name: adapter.outputWrapper.underlyingName,
      symbol: adapter.outputWrapper.underlyingSymbol,
    }))

  const uniswapPoolAdapters = data.adapters
    .filter((adapter: any) => adapter.protocol === 'Uniswap' && adapter.outputWrapper.poolTokenSymbols !== null)
    .map(({ outputWrapper, id }: any) => ({
      address: toChecksumAddress(id),
      outputWrapper: toChecksumAddress(outputWrapper.id),
      name: `Uniswap ${outputWrapper.poolTokenNames.join('-')} Pool`.replace('Wrapped Ether', 'Ether'),
      symbol: outputWrapper.poolTokenSymbols.join('-').replace('WETH', 'ETH'),
    }))

  const balancerPoolAdapters = data.adapters
    .filter((adapter: any) => adapter.protocol === 'Balancer' && adapter.outputWrapper.poolTokenSymbols !== null)
    .map(({ outputWrapper, id }: any) => ({
      address: toChecksumAddress(id),
      outputWrapper: toChecksumAddress(outputWrapper.id),
      name: `Balancer ${outputWrapper.poolTokenNames.join('-')} Pool`.replace('Wrapped Ether', 'Ether'),
      symbol: outputWrapper.poolTokenSymbols.join('-').replace('WETH', 'ETH'),
    }))

  const balancerExitAdapters = data.adapters
    .filter((adapter: any) => adapter.protocol === 'Balancer' && !adapter.outputWrapper.poolTokenSymbols)
    .map((adapter: any) => ({
      address: toChecksumAddress(adapter.id),
      outputWrapper: toChecksumAddress(adapter.outputWrapper.id),
      name: adapter.outputWrapper.underlyingName,
      symbol: adapter.outputWrapper.underlyingSymbol,
    }))

  res.json({
    actions: [
      {
        id: 'uniswap',
        name: 'Uniswap',
        description: 'Swap for other tokens',
        includeType: ['wrapper', 'uniswap-lp'],
        adapters: uniswapAdapters,
      },
      {
        id: 'uniswap-pool',
        name: 'Uniswap Pools',
        description: 'Provide liquidity & earn trading fees',
        includeType: ['wrapper'],
        adapters: uniswapPoolAdapters,
      },
      {
        id: 'aave',
        name: 'Aave Lending',
        description: 'Lend your tokens and earn interest',
        includeUnderlying: [],
        adapters: [
          {
            address: '0x81a6aea5ac2f59454116d701c0e297fdf3e4124e',
            name: 'Aave',
            symbol: 'Aave',
          },
        ],
      },
      {
        id: 'balancer',
        name: 'Balancer Pools',
        description: 'Provide liquidity & earn trading fees',
        includeType: ['wrapper'],
        adapters: balancerPoolAdapters,
      },
      {
        id: 'balancer',
        name: 'Balancer Exit',
        description: 'Remove liquidity from Balancer pools',
        includeType: ['balancer-lp'],
        adapters: balancerExitAdapters,
      },
      {
        id: 'unwrap',
        name: 'Unwrap',
        description: 'Convert DeFi777 tokens back to ERC20 tokens',
        adapters: [
          {
            address: '0x6199F21467853Bea01187C5f093e37B0A578157f',
            name: 'Unwrap',
            symbol: 'Unwrap',
          },
        ],
      },
    ],
  })
}

export default handler
