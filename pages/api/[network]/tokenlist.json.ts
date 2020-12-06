import { NextApiRequest, NextApiResponse } from 'next'
import { toChecksumAddress } from 'ethereum-checksum-address'
import { gqlQuery } from 'lib/graph'
import { getNetworkId } from 'lib/networks'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const data = await gqlQuery(req.query.network, `
    query {
      wrapped777S {
        id
        underlyingAddress
        underlyingName
        underlyingSymbol
      }
    }`)

  const chainId = getNetworkId(req.query.network)

  const wrapperTokens = data.wrapped777S.map((token: any) => ({
    chainId,
    address: toChecksumAddress(token.id),
    symbol: `${token.underlyingSymbol}777`,
    name: `${token.underlyingName}-777`,
    decimals: 18,
    logoURI: "https://raw.githubusercontent.com/Synthetixio/synthetix-assets/v2.0.3/snx/SNX.svg",
    tags: ["erc777"],
  }))

  const normalTokens = data.wrapped777S.map((token: any) => ({
    chainId,
    address: toChecksumAddress(token.underlyingAddress),
    symbol: token.underlyingSymbol || 'UNKNOWN',
    name: token.underlyingName || 'UNKNOWN',
    decimals: 18,
    logoURI: "https://raw.githubusercontent.com/Synthetixio/synthetix-assets/v2.0.3/snx/SNX.svg",
    tags: ["erc20"],
  }))

  res.json({
    name: "DeFi777",
    logoURI: "https://raw.githubusercontent.com/Synthetixio/synthetix-assets/v2.0.3/snx/SNX.svg",
    keywords: ["defi", "defi777", "wrapper"],
    timestamp: "2020-10-08T09:44:03.362Z",
    tags: {
      "erc777": {
        "name": "ERC777",
        "description": "Token that implements the ERC777 standard."
      },
      "erc20": {
        "name": "ERC20",
        "description": "Token that implements the ERC20 standard and does not implement the ERC777 standard."
      },
      "uni": {
        "name": "Uniswap LP Token",
        "description": "Liquidity Provider token for Uniswap V2."
      },
      "uni777": {
        "name": "Uniswap LP Wrapper",
        "description": "DeFi777 wrapper on a Uniswap LP token."
      },
      "farmer": {
        "name": "Farmer token",
        "description": "A wrapper token that farms other tokens."
      }
    },
    version: { major: 0, minor: 0, patch: 0 },
    tokens: [...wrapperTokens, ...normalTokens],
  })
}

export default handler
