# FROSTLINE continuation review

Reviewed from `ac18088` (2026-10-14).

## Current foundation

This is a browser/mobile survival queue-tycoon, with progression from manual
wood/food deliveries to staffed production, conveyors, prestige, and industrial
freight. It already has a substantial gameplay loop; extending the existing
simulation is preferable to restarting it.

The mutable simulation is separate from React Three Fiber rendering, UI updates
are throttled, and balance formulas are shared between purchases and save
loading. Procedural assets avoid external asset loading and licensing overhead.
These are useful foundations for a mobile game.

## First continuation: reliable refresh and offline rewards

- Save and restore the player's mixed-resource backpack, validating resource
  names and respecting its upgraded capacity. Old saves default to an empty pack.
- Save unclaimed offline payouts. Previously a save updated the time-away
  boundary but discarded the popup's reward, losing it on refresh.
- Persist new offline credit immediately together with its time boundary.
- Save normal/double claims immediately, preserving cash and the daily double
  limit even if the player refreshes before the next autosave.
- Add `npm test`, using Vite and Node's built-in runner without new dependencies.
  Nine regression tests cover these behaviors, v2/v3 compatibility, the offline
  time cap, and protection against old-camp saves during prestige.

No balance changes or new save-format version are needed: these fields are
optional additions to v3.

## Next priorities found in source review

1. **Finish inventory conservation on save.** Workers currently serialize only
   their roles, so goods in their packs disappear. Ground drops and partially
   loaded caravan/freight orders are also omitted. Rehydrating those deliveries
   needs explicit rules to avoid double payment or duplication. Existing belt
   goods are returned to their source buffers, but load-time capacity clamps can
   discard overflow; include full-buffer tests in the next persistence pass.
2. **Make background handling explicit.** `SimDriver` ticks whenever R3F renders;
   it does not check visibility. A browser that keeps rendering a hidden tab may
   advance gameplay instead of accumulating offline time. Suspend simulation and
   reset touch/keyboard input at background transitions, then verify mobile
   resume behavior.
3. **Add full production-chain simulations.** Test crew-to-machine retirement,
   source reservations, export shares, freight payouts, and prestige using the
   real systems. The new save tests are the start of automated coverage.
4. **Measure mobile rendering before expanding the map.** Adaptive resolution is
   present, but the entire world remains mounted. Profile the industrial park on
   actual phones, then consider distance-based detail and render culling.
5. **Clarify built-output hosting.** `dist/` contains many old hashed bundles and
   is committed. Establish whether deployment builds from source or serves this
   directory before replacing or deleting checked-in output. This change leaves
   committed build artifacts untouched.

This review is based on source inspection and automated simulation checks;
it does not establish gameplay balance or actual-device frame rates. The
remaining inventory/background findings are follow-up work, not claimed fixes.
