import { NextApiRequest, NextApiResponse } from 'next'
import { toChecksumAddress } from 'ethereum-checksum-address'

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*")

  const request = await fetch('https://api.thegraph.com/subgraphs/name/defi-777/kovan', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
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
      }`,
      variables: null,
    }),
  })

  const { data, errors } = await request.json()
  if (errors) {
    return res.status(500).json({ errors })
  }

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
            address: '0xcA5587f03bbC142aB230075E6CA2EaC3768a52Af',
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
