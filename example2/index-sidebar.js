const nav = atom({ showNav: false })

const useToggleNav = action(nav, (state, val) => {
  const showNav = !!state.showNav
  return val === undefined || showNav !== val
    ? { ...state, showNav: !showNav }
    : state
})

const data = atom({ company: null, user: null, people: null })
const useData = (selector) => useValue(data, selector)
const useDataMap = (selector) => useValueMap(data, selector)
const useDataList = (selector) => useValueList(data, selector)


//   const {
//     navOpen,
//     compactSidebarMode,
//     compactSidebarExpanded,
//     company,
//   } = useSelector(state => ({
//     navOpen: state.showNav,
//     compactSidebarMode: state.compactSidebarMode,
//     compactSidebarExpanded: state.compactSidebarExpanded,
//     company: state.company,
//   }))

// export default () => {
//   return {
//     toggleCompactSidebarMode({ get, set }, val) {
//       const compactSidebarMode = !!get().compactSidebarMode

//       if (val === undefined || val !== compactSidebarMode) {
//         const next = !compactSidebarMode
//         set({ compactSidebarMode: next, compactSidebarExpanded: false })
//       }
//     },

//     expandCompactSidebar({ get, set }, val) {
//       const compactSidebarExpanded = !!get().compactSidebarExpanded

//       if (val === undefined || val !== compactSidebarExpanded) {
//         set({ compactSidebarExpanded: !compactSidebarExpanded })
//       }
//     },

//     closeNav({ set }) {
//       set({ showNav: false })
//     },

//     toggleProfileNav({ get, set }, val) {
//       const showProfileNav = !!get().showProfileNav

//       if (val === undefined || showProfileNav !== val) {
//         set({ showProfileNav: !showProfileNav })
//       }
//     },

//     setToOpen({ get, set }, val) {
//       set({ toOpen: val })
//     },

//     clearToOpen({ get, set }) {
//       set({ toOpen: null })
//     },

//     openJumpPad({ get, set }) {
//       set({ openJumpPad: get().openJumpPad ? get().openJumpPad + 1 : 1 })
//     },
//   }
// }


import React, { useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
// import { useData } from '@app/hooks/useData'
import { atom, action, useValue } from '../src'
import './styles.css'

function App({ version }) {
  const name = useData(state => state.company.name)
  const { company } = useDataMap(state => ({ company: state.company, version }))

  const showNav = useValue(nav, state => state.showNav)
  const toggleNav = useToggleNav()

  return (
    <div>
      {showNav} <button onClick={toggleNav}>Toggle</button>
    </div>
  )
}

ReactDOM.render(<App />, document.querySelector('#root'))
