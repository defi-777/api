import { NextApiRequest, NextApiResponse } from 'next'
import { toChecksumAddress } from 'ethereum-checksum-address'
import { gqlQuery } from 'lib/graph'

const wethByChain: { [chain: string]: string } = {
  kovan: '0xd0A1e359811322D97991e03f863a0c30c2Cf029c',
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  const network = req.query.network as string

  const data = await gqlQuery(network, `
    query {
      adapters {
        id
        protocol
        outputWrapper {
          id
          underlyingName
          underlyingSymbol
          poolTokenAddresses
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
      includeUnderlying: outputWrapper.poolTokenAddresses
        .map(toChecksumAddress)
        .map((address: string) => address === wethByChain[network] ? ZERO_ADDRESS : address),
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
        includeType: ['erc777', 'eth'],
        includeProtocol: [null, 'Uniswap'],
        adapters: [
          {
            address: '0x2677a1c1e6BFaE4822AF9aA877E9549B664484fa',
            outputWrapper: ZERO_ADDRESS,
            name: 'Ether',
            symbol: 'ETH',
          },
          ...uniswapAdapters,
        ],
      },
      {
        id: 'uniswap-pool',
        name: 'Uniswap Pools',
        description: 'Provide liquidity & earn trading fees',
        includeType: ['erc777', 'eth'],
        includeProtocol: [null],
        adapters: uniswapPoolAdapters,
      },
      {
        id: 'aave',
        name: 'Aave Lending',
        description: 'Lend your tokens and earn interest',
        includeType: ['erc777', 'eth'],
        includeProtocol: [null],
        adapters: [
          {
            address: '0xf7D5a5177D84dFA0F79C78f1f6704199C713f01f',
            name: 'Aave',
            symbol: 'Aave',
          },
        ],
      },
      {
        id: 'balancer',
        name: 'Balancer Pools',
        description: 'Provide liquidity & earn trading fees',
        includeType: ['erc777', 'eth'],
        includeProtocol: [null],
        adapters: balancerPoolAdapters,
      },
      {
        id: 'balancer-exit',
        name: 'Balancer Exit',
        description: 'Remove liquidity from Balancer pools',
        includeProtocol: ['Balancer'],
        adapters: [
          {
            address: '0xC2576315CAd071Ed6A50e5e191f10D26f27B0AbE',
            outputWrapper: ZERO_ADDRESS,
            name: 'Ether',
            symbol: 'ETH',
          },
          ...balancerExitAdapters,
        ],
      },
      {
        id: 'unwrap',
        name: 'Unwrap',
        description: 'Convert DeFi777 tokens back to ERC20 tokens',
        includeType: ['erc777'],
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
