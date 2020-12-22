import { NextApiRequest, NextApiResponse } from 'next'
import { toChecksumAddress } from 'ethereum-checksum-address'
import { gqlQuery } from 'lib/graph'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const wethByChain: { [network: string]: string } = {
  kovan: '0xd0A1e359811322D97991e03f863a0c30c2Cf029c',
  mainnet: '0xc02aaA39b223fE8d0a0e5C4F27EAD9083C756cc2',
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
  factory?: {
    address: string
  },
  includeType?: string[]
  includeProtocol?: (string | null)[]
  includeUnderlying?: string[]
  adapters: Adapter[]
}

function allAdapterPoolTokens(adapters: any[]): string[] {
  return Array.from(adapters.reduce((set: Set<string>, adapter: any) => {
    adapter.outputWrapper.poolTokenAddresses.forEach((address: string) =>
      set.add(toChecksumAddress(address)))
    return set
  }, new Set<string>()))
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
          protocol
          underlyingName
          underlyingSymbol
          poolTokenAddresses
          poolTokenSymbols
          poolTokenNames
        }
        supportedWrappers {
          underlyingAddress
          protocol
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

  const actions: Action[] = [
    {
      id: 'uniswap',
      name: 'Uniswap',
      description: 'Swap for other tokens',
      includeType: ['erc777', 'eth'],
      includeProtocol: [null, 'Uniswap'],
      factory: {
        address: '0x8CD1a9Be80cB1827458AF6bB9ca5B0dAAAE36C1f',
      },
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

  const balancerAdapters = data.adapters.filter((adapter: any) => adapter.protocol === 'Balancer')
  if (balancerAdapters.length > 0) {
    const entryAdapters = balancerAdapters.filter((adapter: any) => adapter.outputWrapper.protocol)
    actions.push({
      id: 'balancer',
      name: 'Balancer Pools',
      description: 'Provide liquidity & earn trading fees',
      includeType: ['erc777', 'eth'],
      includeUnderlying: [
        ZERO_ADDRESS,
        ...allAdapterPoolTokens(entryAdapters),
      ],
      adapters: entryAdapters.map(({ outputWrapper, id }: any) => ({
          address: toChecksumAddress(id),
          outputWrapper: toChecksumAddress(outputWrapper.id),
          name: `Balancer ${outputWrapper.poolTokenNames.join('-')} Pool`.replace('Wrapped Ether', 'Ether'),
          symbol: outputWrapper.poolTokenSymbols.join('-').replace('WETH', 'ETH'),
          includeUnderlying: outputWrapper.poolTokenAddresses
            .map(toChecksumAddress)
            .map((address: string) => address === wethByChain[network] ? ZERO_ADDRESS : address),
        })),
    })

    const exitAdapters = balancerAdapters.filter((adapter: any) => !adapter.outputWrapper.protocol)
    actions.push({
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
        ...exitAdapters.map((adapter: any) => ({
          address: toChecksumAddress(adapter.id),
          outputWrapper: toChecksumAddress(adapter.outputWrapper.id),
          name: adapter.outputWrapper.underlyingName,
          symbol: adapter.outputWrapper.underlyingSymbol,
        })),
      ],
    })
  }

  const curveAdapters = data.adapters.filter((adapter: any) => adapter.protocol === 'Curve')
  if (curveAdapters.length > 0) {
    const entryAdapters = curveAdapters
      .filter((adapter: any) => adapter.outputWrapper.protocol)
      // Hide broken 3pool adapter
      .filter((adapter: any) => adapter.outputWrapper.underlyingSymbol !== '3Crv')
    actions.push({
      id: 'curve',
      name: 'Curve',
      description: 'Earn trading fees for stable-pair assets',
      includeType: ['erc777'],
      includeUnderlying: allAdapterPoolTokens(entryAdapters),
      adapters: entryAdapters.map((adapter: any) => ({
        address: toChecksumAddress(adapter.id),
        outputWrapper: toChecksumAddress(adapter.outputWrapper.id),
        name: adapter.outputWrapper.underlyingName,
        symbol: adapter.outputWrapper.underlyingSymbol,
        includeUnderlying: adapter.outputWrapper.poolTokenAddresses.map(toChecksumAddress),
      })),
    })

    const exitAdapters = curveAdapters.filter((adapter: any) => !adapter.outputWrapper.protocol)
    actions.push({
      id: 'curve-exit',
      name: 'Curve Withdrawal',
      description: 'Remove your tokens from Curve pools',
      includeProtocol: ['Curve'],
      adapters: exitAdapters.map((adapter: any) => ({
        address: toChecksumAddress(adapter.id),
        outputWrapper: toChecksumAddress(adapter.outputWrapper.id),
        name: adapter.outputWrapper.underlyingName,
        symbol: adapter.outputWrapper.underlyingSymbol,
      })),
    })
  }

  const yearnAdapters = data.adapters.filter((adapter: any) => adapter.protocol === 'yEarn')
  if (yearnAdapters.length > 0) {
    actions.push({
      id: 'yearn',
      name: 'yEarn Vaults',
      description: 'Deposit tokens in yield-optimizing vaults',
      includeUnderlying: yearnAdapters[0].supportedWrappers
        .filter((wrapper: any) => !wrapper.protocol)
        .map((wrapper: any) => toChecksumAddress(wrapper.underlyingAddress)),
      adapters: [
        {
          address: toChecksumAddress(yearnAdapters[0].id),
          name: 'yEarn',
          symbol: 'yEarn',
        },
      ],
    })
    actions.push({
      id: 'yearn-exit',
      name: 'yEarn Withdrawal',
      description: 'Withdraw tokens from yEarn vaults',
      includeProtocol: ['yEarn'],
      adapters: [
        {
          address: toChecksumAddress(yearnAdapters[0].id),
          name: 'yEarn',
          symbol: 'yEarn',
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
