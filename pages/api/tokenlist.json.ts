import { NextApiRequest, NextApiResponse } from 'next'
import { toChecksumAddress } from 'ethereum-checksum-address'

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const request = await fetch('https://api.thegraph.com/subgraphs/name/defi-777/kovan', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
      query {
        wrapped777S {
          id
          underlyingAddress
          underlyingName
          underlyingSymbol
        }
      }`,
      variables: null,
    }),
  })

  const { data, errors } = await request.json()
  if (errors) {
    return res.status(500).json({ errors })
  }

  const wrapperTokens = data.wrapped777S.map((token: any) => ({
    chainId: 42,
    address: toChecksumAddress(token.id),
    symbol: `${token.underlyingSymbol}777`,
    name: `${token.underlyingName}-777`,
    decimals: 18,
    logoURI: "https://raw.githubusercontent.com/Synthetixio/synthetix-assets/v2.0.3/snx/SNX.svg",
    tags: ["erc777"],
  }))

  const normalTokens = data.wrapped777S.map((token: any) => ({
    chainId: 42,
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
