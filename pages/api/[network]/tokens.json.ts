import { NextApiRequest, NextApiResponse } from 'next'
import { toChecksumAddress } from 'ethereum-checksum-address'
import { gqlQuery } from 'lib/graph'
import { getNetworkId } from 'lib/networks'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const data = await gqlQuery(req.query.network as string, `
    query {
      wrapped777S {
        id
        underlyingName
        underlyingSymbol
        underlyingAddress
        underlyingDecimals
        protocol
        yieldWrappers {
          id
          underlyingName
          underlyingSymbol
          underlyingAddress
        }
        yieldAdapters
        poolTokenNames
        poolTokenSymbols
      }
    }`)

  const chainId = getNetworkId(req.query.network as string)

  const wrapperTokens: any[] = []
  const normalTokens: any[] = []

  for (const token of data.wrapped777S) {
    let name = `${token.underlyingName}-777`
    let symbol = `${token.underlyingSymbol}777`

    switch (token.protocol) {
      case 'Uniswap':
        name = `Uniswap ${token.poolTokenNames.join('/')} LP`
        symbol = `UNI-${token.poolTokenSymbols.join('-')}777`
        break
      case 'Balancer':
        name = `Balancer ${token.poolTokenNames.join('/')} LP`
        symbol = `BPT-${token.poolTokenSymbols.join('-')}777`
        break
      default:
    }

    wrapperTokens.push({
      chainId,
      address: toChecksumAddress(token.id),
      symbol,
      name,
      underlying: toChecksumAddress(token.underlyingAddress),
      protocol: token.protocol,
      yieldWrappers: token.yieldWrappers.map((wrapper: any, i: number) => ({
        address: toChecksumAddress(wrapper.id),
        underlyingAddress: toChecksumAddress(wrapper.underlyingAddress),
        underlyingName: wrapper.underlyingName,
        underlyingSymbol: wrapper.underlyingSymbol,
        yieldAdapter: toChecksumAddress(token.yieldAdapters[i]),
      })),
      decimals: 18,
    })

    normalTokens.push({
      chainId,
      address: toChecksumAddress(token.underlyingAddress),
      symbol: token.underlyingSymbol || 'UNKNOWN',
      name: token.underlyingName || 'UNKNOWN',
      decimals: token.underlyingDecimals,
    })
  }

  res.json({
    erc777s: wrapperTokens,
    erc20s: normalTokens,
  })
}

export default handler
