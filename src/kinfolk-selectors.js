import { atom, useSelector, useSetter, useReducer } from 'kinfolk'

const cache = atom({
  entities: {
    e1: {},
    e2: {},
    e3: {},
    n1: {}, // new item comes in
  },
  queries: {
    a1: { itemIds: ['e1'] },
    a2: { itemIds: ['e1', 'e2'] },
    a3: { itemIds: ['e3'] },
  },
})

// a selector caches the computed value and recomputes the value if upstream dependencies change
const query = selector((queryId) => cache(['queries', queryId]))

// stable, granular reference to an item
const item = selector((itemId) => cache(['entities', itemId]))

// we now resolve a live, but stable query result by combining query with items
const queryResult = selector((queryId) => query(queryId).itemIds.map(item))

// we could even further evolve this obj
const enhancedQueryResult = selector((queryId) => heavyOperation(queryResult(queryId)))

export function useSomeQueries(queryConfigs) {
  const [someState, setState] = useState()

  const datas = useSelector(() => {
    return queryConfigs.map((queryId) => {
      // by using the result, we bind to changes to this query
      const q = enhancedQueryResult(queryId)
      return heavyOperationInvolvingState(q, someState)
    })
  }, [queryConfigs, someState])

  return datas
}

// export function useSomeQueries(queries) {
//   // memoises return value! only rerenders if deps changed!
//   const results = useSelector(cache, (cache, memo) => {
//     const results = []

//     for (const qid of queries) {
//       const { queries, entities } = cache.queries
//       const itemIds = memo(() => queries[qid], queries[qid])
//       const items = memo(() => itemIds.map(itemId => entities[itemId], [itemIds]))
//       const itemsMem = memo(() => items, items)
//       const enhancedItems = memo(() => itemsMem.map(expensiveOperation))
//       results.push(itemsMem)
//     }

//     return results
//   }, [...queries])

//   return results
// }

// export function useSomeQueries(queries) {

//   // memoises return value! only rerenders if deps changed!
//   const results = useSelector((get) => {
//     const results = []
//     for (const qid of queries) {
//       // tracks cache
//       const queries = get(cache, cache => cache.queries)
//       // tracks cache
//       const entities = get(cache, cache => cache.entities)

//       // tracks queries
//       const itemIds = get(queries, queries => queries[qid])

//       // checks computed list by id
//       const queryResult = get.array(itemsIds, itemIds => itemIds.map(itemId => get(entities, entities => entities[itemId])))

//       // avoids recomputing if input same
//       const enhancedQueryResults = get(queryResult, queryResult => map(expensiveOperation))

//       results.push(queryResult)
//     }
//     return results
//   }, [...queries])

//   return results
// }

// what if...
// cache full objects in queries, not entities..
