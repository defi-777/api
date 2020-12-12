import { NextApiRequest, NextApiResponse } from 'next'
import { toChecksumAddress } from 'ethereum-checksum-address'
import { gqlQuery } from 'lib/graph'
import { aaveUnderlyingByNetwork } from 'data/aave'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const wethByChain: { [network: string]: string } = {
  kovan: '0xd0A1e359811322D97991e03f863a0c30c2Cf029c',
}

interface Adapter {
  address: string
  outputWrapper?: string
  name: string
  symbol: string
}

interface Action {
  id: string
  name: string
  description: string
  includeType?: string[]
  includeProtocol?: (string | null)[]
  includeUnderlying?: string[]
  adapters: Adapter[]
}

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
        supportedWrappers {
          underlyingAddress
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

  const actions: Action[] = [
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
      // TODO index this
      includeUnderlying: aaveUnderlyingByNetwork[network],
      adapters: [
        {
          address: '0xf7D5a5177D84dFA0F79C78f1f6704199C713f01f',
          name: 'Aave',
          symbol: 'Aave',
        },
      ],
    },
    {
      id: 'aave-exit',
      name: 'Aave Withdrawal',
      description: 'Withdraw your tokens from Aave',
      includeType: ['erc777'],
      includeProtocol: ['Aave'],
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
  ]

  const compoundAdapters = data.adapters.filter((adapter: any) => adapter.protocol === 'Compound')
  if (compoundAdapters.length > 0) {
    actions.push({
      id: 'compound',
      name: 'Compound',
      description: 'Lend your tokens and earn interest',
      includeType: ['erc777', 'eth'],
      includeUnderlying: [
        ZERO_ADDRESS,
        ...compoundAdapters[0].supportedWrappers.map((wrapper: any) =>
          toChecksumAddress(wrapper.underlyingAddress)),
      ],
      adapters: [
        {
          address: toChecksumAddress(compoundAdapters[0].id),
          name: 'Compound',
          symbol: 'Compound',
        },
      ],
    })
  }

  actions.push({
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
  })

  res.json({ actions })
}

export default handler
