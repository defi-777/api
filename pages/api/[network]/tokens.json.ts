import { NextApiRequest, NextApiResponse } from 'next'
import { toChecksumAddress } from 'ethereum-checksum-address'
import { gqlQuery } from 'lib/graph'

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
        poolTokenNames
        poolTokenSymbols
      }
    }`)

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
      address: toChecksumAddress(token.id),
      symbol,
      name,
      underlying: toChecksumAddress(token.underlyingAddress),
      type: token.protocol,
      yieldWrappers: token.yieldWrappers,
      decimals: 18,
    })

    normalTokens.push({
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
