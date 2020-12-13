export async function gqlQuery(network: string, query: string): Promise<any> {
  const request = await fetch(`https://api.thegraph.com/subgraphs/name/defi-777/${network}`, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: null,
    }),
  })

  const { data, errors } = await request.json()
  if (errors) {
    console.error(errors)
    throw new Error(errors[0].message)
  }
  return data
}
