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
      symbol: `UNI-${outputPoolWrapper.token0Symbol}/${outputPoolWrapper.token1Symbol}`.replace('WETH', 'ETH'),
    }))

  res.json({
    actions: [
      {
        id: 'uniswap',
        name: 'Uniswap',
        description: 'Swap for other tokens',
        adapters: uniswapAdapters,
      },
      {
        id: 'uniswap-pool',
        name: 'Uniswap Pools',
        description: 'Provide liquidity & earn trading fees',
        adapters: uniswapPoolAdapters,
      },
      {
        id: 'aave',
        name: 'Aave Lending',
        description: 'Lend your tokens and earn interest',
        adapters: [],
      },
    ],
  })
}

export default handler
