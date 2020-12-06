import { NextApiRequest, NextApiResponse } from 'next'
import { toChecksumAddress } from 'ethereum-checksum-address'
import { gqlQuery } from 'lib/graph'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*")

  const data = await gqlQuery(req.query.network as string, `
    query {
      uniswapAdapters {
        id
        outputWrapper {
          id
          underlyingName
          underlyingSymbol
        }
        outputPoolWrapper {
          id
          token0Name
          token0Symbol
          token0Address
          token1Name
          token1Symbol
          token1Address
        }
      }
    }`)

  const uniswapAdapters = data.uniswapAdapters
    .filter((adapter: any) => !adapter.outputPoolWrapper)
    .map((adapter: any) => ({
      address: toChecksumAddress(adapter.id),
      outputWrapper: toChecksumAddress(adapter.outputWrapper.id),
      name: adapter.outputWrapper.underlyingName,
      symbol: adapter.outputWrapper.underlyingSymbol,
    }))

  const uniswapPoolAdapters = data.uniswapAdapters
    .filter((adapter: any) => adapter.outputPoolWrapper)
    .map(({ outputPoolWrapper, id }: any) => ({
      address: toChecksumAddress(id),
      outputWrapper: toChecksumAddress(outputPoolWrapper.id),
      name: `Uniswap ${outputPoolWrapper.token0Name}-${outputPoolWrapper.token1Name} Pool`.replace('Wrapped Ether', 'Ether'),
      symbol: `${outputPoolWrapper.token0Symbol}-${outputPoolWrapper.token1Symbol}`.replace('WETH', 'ETH'),
    }))

  res.json({
    actions: [
      {
        id: 'uniswap',
        name: 'Uniswap',
        description: 'Swap for other tokens',
        excludeTag: 'erc20',
        adapters: uniswapAdapters,
      },
      {
        id: 'uniswap-pool',
        name: 'Uniswap Pools',
        description: 'Provide liquidity & earn trading fees',
        excludeTag: 'erc20',
        adapters: uniswapPoolAdapters,
      },
      {
        id: 'aave',
        name: 'Aave Lending',
        description: 'Lend your tokens and earn interest',
        excludeTag: 'erc20',
        adapters: [
          {
            address: '0x81a6aea5ac2f59454116d701c0e297fdf3e4124e',
            name: 'Aave',
            symbol: 'Aave',
          },
        ],
      },
      {
        id: 'unwrap',
        name: 'Unwrap',
        description: 'Convert DeFi777 tokens back to ERC20 tokens',
        includeTag: 'erc777',
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
