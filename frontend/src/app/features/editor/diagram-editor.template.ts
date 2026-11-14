export const diagramEditorTemplate = `
<div class="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden">
  <!-- Screen-reader live region -->
  <div class="sr-only" aria-live="polite">{{ liveAnnouncement() }}</div>

  <!-- Top Editor Bar (56px) -->
  <header class="h-14 shrink-0 border-b border-slate-800/90 bg-slate-900/95 px-4 flex items-center justify-between gap-3 z-30">
    <div class="flex items-center gap-3 min-w-0">
      <a
        [routerLink]="['/']"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-label="Back to live view"
      >
        <span class="material-symbols-outlined text-base">arrow_back</span>
        <span>Back to live</span>
      </a>

      <div class="h-4 w-px bg-slate-800"></div>

      <!-- Project Selector -->
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-sky-400 text-base">account_tree</span>
        <select
          aria-label="Select project"
          class="bg-slate-800/90 border border-slate-700/80 text-slate-100 text-xs font-semibold rounded-lg px-2.5 py-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          [ngModel]="projectId()"
          (ngModelChange)="onProjectSwitch($event)"
        >
          @for (p of projects(); track p.id) {
            <option [value]="p.id">{{ p.name }}</option>
          }
        </select>
      </div>

      <!-- Draft Save Status -->
      <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-[11px] font-mono">
        @if (saveStatus() === 'saved') {
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span class="text-slate-300">Draft v{{ baseVersion() }} · Saved</span>
        } @else if (saveStatus() === 'saving') {
          <span class="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
          <span class="text-sky-300">Saving...</span>
        } @else if (saveStatus() === 'dirty') {
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          <span class="text-amber-300">Unsaved edits</span>
        } @else {
          <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          <button
            type="button"
            (click)="saveDraftNow()"
            class="text-rose-300 underline cursor-pointer"
          >
            Save error · Retry
          </button>
        }
      </div>
    </div>

    <!-- Center / Right Actions -->
    <div class="flex items-center gap-2">
      <!-- Undo / Redo -->
      <div class="hidden md:flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-0.5">
        <button
          type="button"
          (click)="undo()"
          [disabled]="!history.canUndo()"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          class="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span class="material-symbols-outlined text-base">undo</span>
        </button>
        <button
          type="button"
          (click)="redo()"
          [disabled]="!history.canRedo()"
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          class="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span class="material-symbols-outlined text-base">redo</span>
        </button>
      </div>

      <!-- Auto-Layout Menu -->
      <div class="relative hidden sm:block">
        <button
          type="button"
          (click)="showLayoutMenu.set(!showLayoutMenu())"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 text-xs font-medium text-slate-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span class="material-symbols-outlined text-sm">auto_awesome_mosaic</span>
          <span>Layout</span>
          <span class="material-symbols-outlined text-xs">expand_more</span>
        </button>
        @if (showLayoutMenu()) {
          <div class="absolute right-0 mt-1.5 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1.5 z-50 text-xs">
            <button
              type="button"
              (click)="runAutoLayout('LR')"
              class="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
            >
              <span class="material-symbols-outlined text-sm text-sky-400">east</span>
              <span>Auto-layout Left to Right</span>
            </button>
            <button
              type="button"
              (click)="runAutoLayout('TB')"
              class="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
            >
              <span class="material-symbols-outlined text-sm text-indigo-400">south</span>
              <span>Auto-layout Top to Bottom</span>
            </button>
            <div class="my-1 border-t border-slate-800"></div>
            <button
              type="button"
              (click)="runTidySelection()"
              class="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
            >
              <span class="material-symbols-outlined text-sm text-emerald-400">grid_on</span>
              <span>Tidy & snap selection</span>
            </button>
          </div>
        }
      </div>

      <!-- Validation Pill -->
      <button
        type="button"
        (click)="showValidationDrawer.set(!showValidationDrawer())"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        [ngClass]="
          errorIssues().length > 0
            ? 'bg-rose-950/60 border-rose-700/70 text-rose-300'
            : warningIssues().length > 0
              ? 'bg-amber-950/50 border-amber-700/60 text-amber-300'
              : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
        "
        aria-label="Toggle validation issues"
      >
        <span class="material-symbols-outlined text-sm">
          {{ errorIssues().length > 0 ? 'error' : warningIssues().length > 0 ? 'warning' : 'verified' }}
        </span>
        <span>{{ errorIssues().length }}E · {{ warningIssues().length }}W</span>
      </button>

      <!-- Version History button -->
      <button
        type="button"
        (click)="showVersionsModal.set(true)"
        aria-label="Version history"
        title="Version history"
        class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <span class="material-symbols-outlined text-base">history</span>
      </button>

      <!-- Preview Flow Button -->
      <button
        type="button"
        (click)="previewRunning() ? stopPreviewFlow() : runPreviewFlow()"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        [ngClass]="
          previewRunning()
            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
            : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-100'
        "
      >
        <span class="material-symbols-outlined text-sm">
          {{ previewRunning() ? 'stop_circle' : 'play_arrow' }}
        </span>
        <span>{{ previewRunning() ? 'Stop preview' : 'Preview' }}</span>
      </button>

      <!-- Publish Button -->
      <button
        type="button"
        (click)="openPublishModal()"
        [disabled]="isPhoneView()"
        class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-sm transition-colors disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        <span class="material-symbols-outlined text-sm">publish</span>
        <span>Publish</span>
      </button>
    </div>
  </header>

  <!-- Optimistic Concurrency Conflict Banner (Section 9.4) -->
  @if (conflictState(); as conflict) {
    <div class="bg-amber-950/90 border-b border-amber-700 px-4 py-2 flex items-center justify-between text-xs text-amber-200 z-30">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-base text-amber-400">sync_problem</span>
        <span>
          Draft was updated by <strong>{{ conflict.updatedBy }}</strong> at {{ conflict.updatedAt }}.
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="reloadServerDraft()"
          class="px-2.5 py-1 rounded bg-amber-800/80 hover:bg-amber-700 text-amber-100 font-semibold cursor-pointer"
        >
          Reload server draft
        </button>
        <button
          type="button"
          (click)="keepMyDraftOverwrite()"
          class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
        >
          Keep mine
        </button>
      </div>
    </div>
  }

  <!-- Phone View-Only Banner (Section 2.5) -->
  @if (isPhoneView()) {
    <div class="bg-slate-900 border-b border-slate-800 px-4 py-2 text-xs text-slate-300 flex items-center gap-2">
      <span class="material-symbols-outlined text-sm text-sky-400">visibility</span>
      <span>Phone view-only mode active. Open on a tablet or desktop screen to edit blocks and connections.</span>
    </div>
  }

  <!-- Main 3-Pane Editor Body -->
  <div class="flex-1 flex min-h-0 relative overflow-hidden">
    <!-- Left Pane: Block Library (280px collapsible) -->
    @if (leftLibraryOpen() && !isPhoneView()) {
      <aside
        aria-label="Block library"
        class="w-[280px] shrink-0 h-full border-r border-slate-800/90 bg-slate-900/90 flex flex-col z-20"
      >
        <!-- Search & Command Palette Trigger -->
        <div class="p-3 border-b border-slate-800/80">
          <div class="relative flex items-center">
            <span class="material-symbols-outlined text-sm text-slate-400 absolute left-2.5">search</span>
            <input
              type="text"
              aria-label="Search blocks by name or tag"
              placeholder="Search blocks... (Ctrl+K)"
              [ngModel]="librarySearch()"
              (ngModelChange)="librarySearch.set($event)"
              class="w-full bg-slate-950/90 border border-slate-800 focus:border-sky-500 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            @if (librarySearch()) {
              <button
                type="button"
                (click)="librarySearch.set('')"
                aria-label="Clear search"
                class="absolute right-2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <span class="material-symbols-outlined text-sm">close</span>
              </button>
            }
          </div>
        </div>

        <!-- Scrollable Packs List -->
        <div class="flex-1 overflow-y-auto p-2.5 space-y-3">
          <!-- Favorites & Recents when not filtering -->
          @if (!librarySearch().trim()) {
            @if (favoriteBlocks().length > 0) {
              <div>
                <div class="px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs text-amber-400">star</span>
                  <span>Favorites</span>
                </div>
                <div class="grid grid-cols-2 gap-1.5 mt-1">
                  @for (blk of favoriteBlocks(); track blk.id) {
                    <button
                      type="button"
                      draggable="true"
                      (dragstart)="onCatalogDragStart($event, blk)"
                      (click)="addBlockFromCatalog(blk)"
                      (mouseenter)="hoveredCatalogBlock.set(blk)"
                      (mouseleave)="hoveredCatalogBlock.set(null)"
                      class="group flex items-center gap-2 p-2 rounded-lg bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800/90 hover:border-slate-700 text-left transition-colors cursor-pointer"
                    >
                      <span
                        class="material-symbols-outlined text-base shrink-0"
                        [style.color]="blk.tint"
                      >
                        {{ stripIconPrefix(blk.icon) }}
                      </span>
                      <span class="text-[11px] font-medium text-slate-200 truncate">{{ blk.name }}</span>
                    </button>
                  }
                </div>
              </div>
            }

            @if (recentBlocks().length > 0) {
              <div>
                <div class="px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs text-sky-400">schedule</span>
                  <span>Recent</span>
                </div>
                <div class="grid grid-cols-2 gap-1.5 mt-1">
                  @for (blk of recentBlocks(); track blk.id) {
                    <button
                      type="button"
                      draggable="true"
                      (dragstart)="onCatalogDragStart($event, blk)"
                      (click)="addBlockFromCatalog(blk)"
                      (mouseenter)="hoveredCatalogBlock.set(blk)"
                      (mouseleave)="hoveredCatalogBlock.set(null)"
                      class="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800/90 border border-slate-800/80 text-left transition-colors cursor-pointer"
                    >
                      <span
                        class="material-symbols-outlined text-base shrink-0"
                        [style.color]="blk.tint"
                      >
                        {{ stripIconPrefix(blk.icon) }}
                      </span>
                      <span class="text-[11px] font-medium text-slate-200 truncate">{{ blk.name }}</span>
                    </button>
                  }
                </div>
              </div>
            }
          }

          <!-- Catalog Packs -->
          @for (pack of filteredCatalogPacks(); track pack.pack) {
            <div class="border border-slate-800/80 rounded-xl bg-slate-950/40 overflow-hidden">
              <button
                type="button"
                (click)="togglePackCollapse(pack.pack)"
                class="w-full px-3 py-2 flex items-center justify-between bg-slate-900/60 hover:bg-slate-800/70 text-left cursor-pointer"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span class="material-symbols-outlined text-xs text-slate-400">
                    {{ collapsedPacks().has(pack.pack) && !librarySearch() ? 'chevron_right' : 'expand_more' }}
                  </span>
                  <span class="text-xs font-semibold text-slate-200 truncate">{{ pack.title }}</span>
                </div>
                <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  {{ pack.blocks.length }}
                </span>
              </button>

              @if (!collapsedPacks().has(pack.pack) || librarySearch()) {
                <div class="p-2 grid grid-cols-1 gap-1">
                  @if (pack.blocks.length === 0) {
                    <p class="text-[11px] text-slate-400 px-2 py-2">
                      Select any block on the canvas and click "Save as My Block" in Appearance.
                    </p>
                  }
                  @for (blk of pack.blocks; track blk.id) {
                    <div
                      draggable="true"
                      (dragstart)="onCatalogDragStart($event, blk)"
                      (click)="addBlockFromCatalog(blk)"
                      (mouseenter)="hoveredCatalogBlock.set(blk)"
                      (mouseleave)="hoveredCatalogBlock.set(null)"
                      class="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 border border-transparent hover:border-slate-700/70 transition-colors cursor-pointer"
                    >
                      <div class="flex items-center gap-2.5 min-w-0">
                        <span
                          class="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                          [style.backgroundColor]="blk.tint + '22'"
                          [style.color]="blk.tint"
                        >
                          <span class="material-symbols-outlined text-sm">
                            {{ stripIconPrefix(blk.icon) }}
                          </span>
                        </span>
                        <div class="min-w-0">
                          <div class="text-xs font-medium text-slate-200 truncate">{{ blk.name }}</div>
                          <div class="text-[10px] font-mono text-slate-400 truncate">
                            {{ blk.category }} · {{ blk.keyPattern }}
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                        @if (blk.isCustom && blk.customBlockId) {
                          <button
                            type="button"
                            (click)="deleteCustomBlock(blk.customBlockId, $event)"
                            aria-label="Delete custom block"
                            class="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            <span class="material-symbols-outlined text-xs">delete</span>
                          </button>
                        } @else {
                          <button
                            type="button"
                            (click)="toggleFavoriteBlock(blk.id, $event)"
                            aria-label="Toggle favorite block"
                            class="p-1 text-slate-400 hover:text-amber-400 cursor-pointer"
                          >
                            <span class="material-symbols-outlined text-xs">
                              {{ favoriteBlockIds().has(blk.id) ? 'star' : 'star_border' }}
                            </span>
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Hovered Block Tooltip & Vendor Attribution Notice (Section 5.5) -->
        @if (hoveredCatalogBlock(); as hovered) {
          <div class="p-3 border-t border-slate-800 bg-slate-950/90 text-xs space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-semibold text-slate-100">{{ hovered.name }}</span>
              <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                {{ hovered.keyPattern }}
              </span>
            </div>
            <p class="text-[11px] text-slate-300 leading-snug">{{ hovered.snippetHint }}</p>
          </div>
        } @else {
          <div class="px-3 py-2 border-t border-slate-800/80 bg-slate-950/60 text-[10px] text-slate-400 leading-tight">
            Generic neutral icons active. Not affiliated with or endorsed by cloud or tech vendors.
          </div>
        }
      </aside>
    }

    <!-- Left Library Collapse Toggle Button -->
    @if (!isPhoneView()) {
      <button
        type="button"
        (click)="leftLibraryOpen.set(!leftLibraryOpen())"
        aria-label="Toggle block library sidebar"
        class="absolute top-3 z-20 p-1.5 rounded-r-lg bg-slate-900 border border-l-0 border-slate-700 text-slate-300 hover:text-white cursor-pointer"
        [style.left.px]="leftLibraryOpen() ? 280 : 0"
      >
        <span class="material-symbols-outlined text-sm">
          {{ leftLibraryOpen() ? 'chevron_left' : 'chevron_right' }}
        </span>
      </button>
    }

    <!-- Center Pane: Interactive SVG Canvas -->
    <main
      class="flex-1 h-full relative overflow-hidden"
      [ngClass]="diagram().themePreview === 'light' ? 'bg-amber-50/95 text-slate-900' : 'bg-[#090D16] text-slate-100'"
      (dragover)="onCanvasDragOver($event)"
      (drop)="onCanvasDrop($event)"
    >
      <!-- Blank Canvas Empty State Overlay -->
      @if (diagram().nodes.length === 0 && (diagram().groups?.length || 0) === 0) {
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-6">
          <div class="max-w-md w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-6 text-center shadow-2xl pointer-events-auto">
            <div class="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center mx-auto mb-3">
              <span class="material-symbols-outlined text-2xl">draw</span>
            </div>
            <h2 class="text-base font-bold text-slate-100">Blank Canvas Ready</h2>
            <p class="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Drag blocks from the left library, double-click anywhere on the canvas, or press
              <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">Ctrl+K</kbd>
              to place your first block.
            </p>
            <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                (click)="showCommandPalette.set(true)"
                class="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Add first block
              </button>
              <button
                type="button"
                (click)="showImportModal.set(true)"
                class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
              >
                Import JSON
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Main SVG Surface -->
      <svg
        #canvasSvg
        class="w-full h-full block"
        [ngClass]="spacePressed() ? 'cursor-grab' : 'cursor-default'"
        (mousedown)="onCanvasMouseDown($event)"
        (dblclick)="onCanvasDoubleClick($event)"
        (wheel)="onCanvasWheel($event)"
        role="application"
        aria-label="Diagram editor canvas"
      >
        <defs>
          <pattern id="editor-dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle
              cx="2"
              cy="2"
              r="1"
              [attr.fill]="diagram().themePreview === 'light' ? '#CBD5E1' : '#1E293B'"
            />
          </pattern>
          <marker
            id="edge-arrow-default"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#64748B" />
          </marker>
          <marker
            id="edge-arrow-selected"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#0EA5E9" />
          </marker>
        </defs>

        @if (showGrid()) {
          <rect width="100%" height="100%" fill="url(#editor-dot-grid)" />
        }

        <g [attr.transform]="'translate(' + panX() + ',' + panY() + ') scale(' + zoom() + ')'">
          <!-- Alignment Snap Guides -->
          @if (alignmentGuides().x !== undefined) {
            <line
              [attr.x1]="alignmentGuides().x"
              y1="-2000"
              [attr.x2]="alignmentGuides().x"
              y2="4000"
              stroke="#0EA5E9"
              stroke-width="1"
              stroke-dasharray="4 4"
            />
          }
          @if (alignmentGuides().y !== undefined) {
            <line
              x1="-2000"
              [attr.y1]="alignmentGuides().y"
              x2="4000"
              [attr.y2]="alignmentGuides().y"
              stroke="#0EA5E9"
              stroke-width="1"
              stroke-dasharray="4 4"
            />
          }

          <!-- Groups / Zones Layer -->
          @for (grp of diagram().groups || []; track grp.id) {
            <g
              class="cursor-pointer"
              (mousedown)="onGroupMouseDown($event, grp)"
            >
              <rect
                [attr.x]="grp.x"
                [attr.y]="grp.y"
                [attr.width]="grp.width"
                [attr.height]="grp.collapsed ? 42 : grp.height"
                rx="14"
                [attr.fill]="grp.color + '14'"
                [attr.stroke]="selectedGroupId() === grp.id ? '#0EA5E9' : grp.color"
                [attr.stroke-width]="selectedGroupId() === grp.id ? 2.2 : 1.4"
                stroke-dasharray="6 4"
              />
              <text
                [attr.x]="grp.x + 14"
                [attr.y]="grp.y + 24"
                fill="#E2E8F0"
                font-size="12"
                font-weight="700"
              >
                {{ grp.name }} {{ grp.collapsed ? '(collapsed)' : '' }}
              </text>
            </g>
          }

          <!-- Connections (Edges) Layer -->
          @for (edge of visibleEdges(); track edge.id) {
            <g
              class="cursor-pointer"
              (click)="selectEdge(edge.id, $event)"
            >
              <!-- Wide invisible hit target -->
              <path
                [attr.d]="getEdgePath(edge)"
                fill="none"
                stroke="transparent"
                stroke-width="14"
              />
              <path
                [attr.d]="getEdgePath(edge)"
                fill="none"
                [attr.stroke]="getEdgeStrokeColor(edge)"
                [attr.stroke-width]="getEdgeStrokeWidth(edge)"
                [attr.stroke-dasharray]="
                  edge.status === 'discovered' || edge.style?.dashed ? '6 4' : null
                "
                [attr.marker-end]="
                  edge.style?.arrowhead === 'none'
                    ? null
                    : selectedEdgeId() === edge.id
                      ? 'url(#edge-arrow-selected)'
                      : 'url(#edge-arrow-default)'
                "
                [attr.marker-start]="
                  edge.style?.direction === 'bidirectional' ? 'url(#edge-arrow-default)' : null
                "
              />

              <!-- Edge Midpoint Label / Weight Chip -->
              @if (edge.label || edge.flow?.condition || edge.flow?.weight !== undefined || edge.status === 'discovered') {
                <g
                  [attr.transform]="
                    'translate(' + getEdgeMidpoint(edge).x + ',' + getEdgeMidpoint(edge).y + ')'
                  "
                >
                  <rect
                    x="-46"
                    y="-11"
                    width="92"
                    height="22"
                    rx="6"
                    fill="#0F172A"
                    [attr.stroke]="selectedEdgeId() === edge.id ? '#0EA5E9' : '#334155'"
                    stroke-width="1"
                  />
                  <text
                    x="0"
                    y="4"
                    text-anchor="middle"
                    fill="#E2E8F0"
                    font-size="10"
                    font-family="monospace"
                  >
                    {{
                      edge.label ||
                        edge.flow?.condition ||
                        (edge.flow?.weight !== undefined ? edge.flow?.weight + '%' : 'discovered')
                    }}
                  </text>
                </g>
              }
            </g>
          }

          <!-- Active Drag-to-Connect Line -->
          @if (connectingFrom(); as conn) {
            <line
              [attr.x1]="conn.startX"
              [attr.y1]="conn.startY"
              [attr.x2]="conn.currX"
              [attr.y2]="conn.currY"
              stroke="#0EA5E9"
              stroke-width="2"
              stroke-dasharray="5 4"
            />
          }

          <!-- Blocks (Nodes) Layer -->
          @for (node of visibleNodes(); track node.key) {
            <g
              [attr.transform]="'translate(' + node.x + ',' + node.y + ')'"
              class="cursor-pointer"
              (mousedown)="onNodeMouseDown($event, node)"
              (mouseup)="onNodeMouseUpForConnect($event, node)"
            >
              <!-- Shape Rendering: Diamond vs Pill vs Card -->
              @if (node.props?.shape === 'diamond') {
                <polygon
                  points="0,-40 62,0 0,40 -62,0"
                  fill="#0F172A"
                  [attr.stroke]="
                    selectedNodeKeys().has(node.key)
                      ? '#0EA5E9'
                      : highlightedPath().nodeKeys.has(node.key)
                        ? '#10B981'
                        : node.props?.tint || '#F59E0B'
                  "
                  [attr.stroke-width]="selectedNodeKeys().has(node.key) ? 2.6 : 1.8"
                />
              } @else {
                <rect
                  [attr.x]="-getNodeHalfSize(node).hw"
                  [attr.y]="-getNodeHalfSize(node).hh"
                  [attr.width]="getNodeHalfSize(node).hw * 2"
                  [attr.height]="getNodeHalfSize(node).hh * 2"
                  [attr.rx]="node.props?.shape === 'pill' ? 28 : 12"
                  [attr.fill]="node.type === 'note' ? '#1E293B' : '#0F172A'"
                  [attr.stroke]="
                    selectedNodeKeys().has(node.key)
                      ? '#0EA5E9'
                      : highlightedPath().nodeKeys.has(node.key)
                        ? '#10B981'
                        : node.props?.tint || '#334155'
                  "
                  [attr.stroke-width]="selectedNodeKeys().has(node.key) ? 2.6 : 1.6"
                />
              }

              <!-- Left Tint Accent Bar for Card Nodes -->
              @if (node.props?.shape !== 'diamond' && node.props?.shape !== 'pill') {
                <rect
                  [attr.x]="-getNodeHalfSize(node).hw + 4"
                  [attr.y]="-getNodeHalfSize(node).hh + 8"
                  width="4"
                  [attr.height]="getNodeHalfSize(node).hh * 2 - 16"
                  rx="2"
                  [attr.fill]="node.props?.tint || '#0EA5E9'"
                />
              }

              <!-- Node Label & Key -->
              <text
                x="0"
                [attr.y]="node.props?.labelPosition === 'below' ? getNodeHalfSize(node).hh + 16 : -2"
                text-anchor="middle"
                fill="#F8FAFC"
                font-size="12"
                font-weight="600"
              >
                {{ node.label.length > 20 ? node.label.slice(0, 19) + '…' : node.label }}
              </text>
              <text
                x="0"
                [attr.y]="node.props?.labelPosition === 'below' ? getNodeHalfSize(node).hh + 29 : 13"
                text-anchor="middle"
                fill="#94A3B8"
                font-size="9.5"
                font-family="monospace"
              >
                {{ node.key }}
              </text>

              <!-- Role Badge (Start / Success / Failure / Abandon) -->
              @if (node.props?.role && node.props?.role !== 'normal') {
                <g [attr.transform]="'translate(' + (getNodeHalfSize(node).hw - 12) + ',' + (-getNodeHalfSize(node).hh - 6) + ')'">
                  <rect
                    x="-24"
                    y="-8"
                    width="48"
                    height="15"
                    rx="7"
                    [attr.fill]="
                      node.props?.role === 'failure'
                        ? '#EF4444'
                        : node.props?.role === 'abandon'
                          ? '#F59E0B'
                          : node.props?.role === 'success'
                            ? '#10B981'
                            : '#0EA5E9'
                    "
                  />
                  <text
                    x="0"
                    y="3"
                    text-anchor="middle"
                    fill="#090D16"
                    font-size="8.5"
                    font-weight="800"
                  >
                    {{ node.props?.role?.toUpperCase() }}
                  </text>
                </g>
              }

              <!-- Validation Issue Dot on Node -->
              @if (nodeIssuesMap().get(node.key); as nIssues) {
                <circle
                  [attr.cx]="-getNodeHalfSize(node).hw + 8"
                  [attr.cy]="-getNodeHalfSize(node).hh + 8"
                  r="5"
                  [attr.fill]="nIssues[0].severity === 'error' ? '#EF4444' : '#F59E0B'"
                />
              }

              <!-- Active Event Counter Badge -->
              @if (node.props?.showCounter !== false && (activeNodeCounters().get(node.key) || 0) > 0) {
                <g [attr.transform]="'translate(' + (-getNodeHalfSize(node).hw + 14) + ',' + (-getNodeHalfSize(node).hh - 8) + ')'">
                  <rect x="-14" y="-8" width="28" height="16" rx="8" fill="#0EA5E9" />
                  <text x="0" y="3" text-anchor="middle" fill="#090D16" font-size="9" font-weight="800">
                    {{ activeNodeCounters().get(node.key) }}
                  </text>
                </g>
              }

              <!-- Input Port -->
              @if (node.props?.maxInPorts !== 0 && node.type !== 'note') {
                <circle
                  [attr.cx]="diagram().direction === 'TB' ? 0 : -getNodeHalfSize(node).hw"
                  [attr.cy]="diagram().direction === 'TB' ? -getNodeHalfSize(node).hh : 0"
                  r="5"
                  fill="#1E293B"
                  stroke="#94A3B8"
                  stroke-width="1.5"
                />
              }

              <!-- Output Port (Drag from here to connect or Quick-Add) -->
              @if (node.props?.maxOutPorts !== 0 && node.type !== 'note') {
                <circle
                  [attr.cx]="diagram().direction === 'TB' ? 0 : getNodeHalfSize(node).hw"
                  [attr.cy]="diagram().direction === 'TB' ? getNodeHalfSize(node).hh : 0"
                  r="6"
                  fill="#0EA5E9"
                  stroke="#0F172A"
                  stroke-width="1.5"
                  class="hover:scale-125 transition-transform cursor-crosshair"
                  (mousedown)="onOutputPortMouseDown($event, node)"
                />
              }
            </g>
          }

          <!-- Animated Request Tokens Layer (Preview & Test Events) -->
          @for (tok of activeTokens(); track tok.traceId) {
            <g [attr.transform]="'translate(' + tok.x + ',' + tok.y + ')'">
              <circle
                r="9"
                [attr.fill]="
                  tok.status === 'error'
                    ? '#EF4444'
                    : tok.status === 'warn'
                      ? '#F59E0B'
                      : '#10B981'
                "
                stroke="#F8FAFC"
                stroke-width="2"
              />
              @if (tok.carryCount > 0) {
                <circle cx="8" cy="-8" r="6" fill="#F97316" />
                <text x="8" y="-5" text-anchor="middle" fill="#FFFFFF" font-size="8" font-weight="700">
                  {{ tok.carryCount }}
                </text>
              }
            </g>
          }

          <!-- Marquee Selection Box -->
          @if (marqueeRect(); as mq) {
            <rect
              [attr.x]="mq.startX < mq.currX ? mq.startX : mq.currX"
              [attr.y]="mq.startY < mq.currY ? mq.startY : mq.currY"
              [attr.width]="(mq.currX - mq.startX) < 0 ? -(mq.currX - mq.startX) : (mq.currX - mq.startX)"
              [attr.height]="(mq.currY - mq.startY) < 0 ? -(mq.currY - mq.startY) : (mq.currY - mq.startY)"
              fill="#0EA5E922"
              stroke="#0EA5E9"
              stroke-width="1"
              stroke-dasharray="4 2"
            />
          }
        </g>
      </svg>

      <!-- Quick-Add Popup (when dragging from port into empty space or double-clicking canvas) -->
      @if (quickAddPopup(); as qa) {
        <div
          class="fixed z-50 w-64 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-2"
          [style.left.px]="qa.screenX"
          [style.top.px]="qa.screenY"
        >
          <div class="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-slate-800">
            <span>{{ qa.fromSourceKey ? 'Connect to new block...' : 'Quick add block' }}</span>
            <button
              type="button"
              (click)="quickAddPopup.set(null)"
              aria-label="Close quick add menu"
              class="text-slate-400 hover:text-white cursor-pointer"
            >
              <span class="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
          <div class="max-h-56 overflow-y-auto mt-1 space-y-0.5">
            @for (blk of allCatalogPacks()[0].blocks; track blk.id) {
              @if (blk.ports.in !== 0 || !qa.fromSourceKey) {
                <button
                  type="button"
                  (click)="addBlockFromCatalog(blk, qa.worldX, qa.worldY, qa.fromSourceKey)"
                  class="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-2 text-left text-xs text-slate-200 cursor-pointer"
                >
                  <span class="material-symbols-outlined text-sm" [style.color]="blk.tint">
                    {{ stripIconPrefix(blk.icon) }}
                  </span>
                  <span>{{ blk.name }}</span>
                </button>
              }
            }
          </div>
        </div>
      }

      <!-- Preview Flow Summary Card (Section 8.3) -->
      @if (previewResult(); as prev) {
        <div class="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-xl w-full px-4 pointer-events-none">
          <div class="rounded-xl bg-slate-900/95 border border-slate-700/90 p-3 shadow-2xl pointer-events-auto">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                  [ngClass]="
                    prev.terminalOutcome === 'failure'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : prev.terminalOutcome === 'abandon'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  "
                >
                  Preview · {{ prev.terminalOutcome }}
                </span>
                <span class="text-xs font-mono text-slate-300">
                  {{ prev.steps.length }} hops · {{ prev.totalLatencyMs }} ms total
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  (click)="runPreviewFlow()"
                  class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-sky-300 cursor-pointer"
                >
                  Replay
                </button>
                <button
                  type="button"
                  (click)="stopPreviewFlow()"
                  aria-label="Close preview summary"
                  class="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <span class="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>
            <div class="mt-2 flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono text-slate-300">
              @for (s of prev.steps; track s.nodeKey + s.cumulativeMs; let last = $last) {
                <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 shrink-0">
                  {{ s.nodeLabel }}
                </span>
                @if (!last) {
                  <span class="text-slate-500">→</span>
                }
              }
            </div>
            @if (prev.unreachableKeys.length > 0) {
              <p class="mt-1 text-[11px] text-amber-300">
                Unreachable blocks: {{ prev.unreachableKeys.join(', ') }}
              </p>
            }
          </div>
        </div>
      }

      <!-- Bottom Floating Canvas Pill (Zoom / Fit / Grid / Snap / Shortcuts) -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-900/95 border border-slate-700/90 shadow-xl text-xs">
        <button
          type="button"
          (click)="setZoom(zoom() - 0.15)"
          aria-label="Zoom out"
          class="p-1 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
        >
          <span class="material-symbols-outlined text-sm">remove</span>
        </button>
        <span class="w-12 text-center font-mono text-[11px] text-slate-200">
          {{ (zoom() * 100) | number:'1.0-0' }}%
        </span>
        <button
          type="button"
          (click)="setZoom(zoom() + 0.15)"
          aria-label="Zoom in"
          class="p-1 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
        >
          <span class="material-symbols-outlined text-sm">add</span>
        </button>

        <div class="h-3.5 w-px bg-slate-700 mx-1"></div>

        <button
          type="button"
          (click)="fitToScreen(false)"
          aria-label="Fit diagram to screen"
          title="Fit to screen (0)"
          class="px-2 py-0.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] cursor-pointer"
        >
          Fit
        </button>

        <button
          type="button"
          (click)="showGrid.set(!showGrid())"
          aria-label="Toggle dot grid"
          class="px-2 py-0.5 rounded-full text-[11px] cursor-pointer"
          [ngClass]="showGrid() ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-white'"
        >
          Grid
        </button>

        <button
          type="button"
          (click)="snapEnabled.set(!snapEnabled())"
          aria-label="Toggle 8px grid snap"
          class="px-2 py-0.5 rounded-full text-[11px] cursor-pointer"
          [ngClass]="snapEnabled() ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-white'"
        >
          Snap
        </button>

        <button
          type="button"
          (click)="showShortcutsModal.set(true)"
          aria-label="Keyboard shortcuts help"
          title="Keyboard shortcuts (?)"
          class="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
        >
          <span class="material-symbols-outlined text-sm">help</span>
        </button>
      </div>

      <!-- Toast Notification -->
      @if (toastMessage(); as toast) {
        <div class="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 px-3.5 py-2 rounded-xl bg-slate-900 border border-sky-500/60 text-xs font-medium text-slate-100 shadow-2xl">
          {{ toast }}
        </div>
      }
    </main>

    <!-- Right Pane: Context-Sensitive Inspector (360px) -->
    @if (!isPhoneView() && !inspectorClosedExplicitly()) {
      <aside
        aria-label="Inspector panel"
        class="w-[360px] shrink-0 h-full border-l border-slate-800/90 bg-slate-900/95 flex flex-col z-20"
      >
        <!-- CASE 1: Single Block Selected (Section 7.1) -->
        @if (selectedSingleNode(); as node) {
          <div class="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                [style.backgroundColor]="(node.props?.tint || '#0EA5E9') + '22'"
                [style.color]="node.props?.tint || '#0EA5E9'"
              >
                <span class="material-symbols-outlined text-base">
                  {{ stripIconPrefix(node.icon) }}
                </span>
              </span>
              <div class="min-w-0">
                <div class="text-xs font-bold text-slate-100 truncate">{{ node.label }}</div>
                <div class="text-[10px] font-mono text-slate-400 truncate">{{ node.key }}</div>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="updateSelectedNodeProp('locked', !node.props?.locked)"
                [attr.aria-label]="node.props?.locked ? 'Unlock block' : 'Lock block'"
                class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <span class="material-symbols-outlined text-sm">
                  {{ node.props?.locked ? 'lock' : 'lock_open' }}
                </span>
              </button>
              <button
                type="button"
                (click)="deleteSelectedElements()"
                aria-label="Delete block"
                class="p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 cursor-pointer"
              >
                <span class="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          </div>

          <!-- Block Inspector Tabs -->
          <div class="grid grid-cols-5 border-b border-slate-800 bg-slate-950/50 text-[11px] font-medium">
            @for (tab of ['general', 'appearance', 'behaviour', 'integration', 'advanced']; track tab) {
              <button
                type="button"
                (click)="nodeInspectorTab.set($any(tab))"
                class="py-2 text-center capitalize border-b-2 transition-colors cursor-pointer"
                [ngClass]="
                  nodeInspectorTab() === tab
                    ? 'border-sky-500 text-sky-400 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                "
              >
                {{ tab }}
              </button>
            }
          </div>

          <div class="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
            @if (nodeInspectorTab() === 'general') {
              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">Label</label>
                <input
                  type="text"
                  aria-label="Block label"
                  [ngModel]="node.label"
                  (ngModelChange)="updateSelectedNodeField('label', $event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="block text-[11px] font-semibold text-slate-300">
                    Key (used by SDK / HTTP events)
                  </label>
                  <button
                    type="button"
                    (click)="copyKeyToClipboard(node.key)"
                    class="text-[10px] font-mono text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span class="material-symbols-outlined text-xs">content_copy</span>
                    <span>Copy</span>
                  </button>
                </div>
                <div class="flex items-center gap-1.5">
                  <input
                    type="text"
                    aria-label="Block key"
                    [ngModel]="editingKeyDraft()"
                    (ngModelChange)="editingKeyDraft.set($event)"
                    class="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                  @if (editingKeyDraft() !== node.key) {
                    <button
                      type="button"
                      (click)="commitNodeKeyRename()"
                      class="px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Apply
                    </button>
                  }
                </div>

                @if (keyUsageCount24h() > 0 || editingKeyDraft() !== node.key) {
                  <div class="p-2.5 rounded-lg bg-amber-950/50 border border-amber-700/60 text-[11px] text-amber-200 space-y-1.5">
                    <div class="flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-sm text-amber-400">warning</span>
                      <span>
                        Used in <strong>{{ keyUsageCount24h() }}</strong> events in the last 24h.
                      </span>
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer text-slate-200">
                      <input
                        type="checkbox"
                        [ngModel]="keepOldKeyAlias()"
                        (ngModelChange)="keepOldKeyAlias.set($event)"
                        class="rounded border-slate-600"
                      />
                      <span>Keep old key "{{ node.key }}" as alias for 7 days</span>
                    </label>
                  </div>
                }

                @if ((node.props?.aliases?.length || 0) > 0) {
                  <div class="text-[11px] text-slate-400 font-mono">
                    Active aliases: {{ node.props?.aliases?.join(', ') }}
                  </div>
                }
              </div>

              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">Block Type</label>
                <select
                  aria-label="Block type"
                  [ngModel]="node.type"
                  (ngModelChange)="updateSelectedNodeField('type', $event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                >
                  <option value="client">Start / Client</option>
                  <option value="gateway">Gateway / Proxy</option>
                  <option value="service">Service</option>
                  <option value="decision">Decision (If / Branch)</option>
                  <option value="parallel">Parallel Split</option>
                  <option value="join">Join / Merge</option>
                  <option value="worker">Worker / Job</option>
                  <option value="queue">Queue / Topic</option>
                  <option value="cache">Cache</option>
                  <option value="db">Datastore</option>
                  <option value="external">External API</option>
                  <option value="end">End / Terminal</option>
                  <option value="note">Note Annotation</option>
                </select>
              </div>

              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">
                  Description / Tooltip
                </label>
                <textarea
                  rows="3"
                  aria-label="Block description"
                  placeholder="Explain what happens at this checkpoint..."
                  [ngModel]="node.props?.description || ''"
                  (ngModelChange)="updateSelectedNodeProp('description', $event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                ></textarea>
              </div>

              <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span class="text-[11px] text-slate-400">Keyboard Connect</span>
                <button
                  type="button"
                  (click)="showConnectModal.set(true)"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
                >
                  Connect to block...
                </button>
              </div>
            }

            @if (nodeInspectorTab() === 'appearance') {
              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">Tint Token</label>
                <div class="flex flex-wrap gap-2">
                  @for (t of tintPalette; track t.hex) {
                    <button
                      type="button"
                      (click)="updateSelectedNodeProp('tint', t.hex)"
                      [attr.aria-label]="'Select tint ' + t.name"
                      class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
                      [style.backgroundColor]="t.hex"
                      [style.borderColor]="node.props?.tint === t.hex ? '#FFFFFF' : 'transparent'"
                    ></button>
                  }
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">Shape</label>
                  <select
                    aria-label="Node shape"
                    [ngModel]="node.props?.shape || 'card'"
                    (ngModelChange)="updateSelectedNodeProp('shape', $event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                  >
                    <option value="card">Card</option>
                    <option value="pill">Pill</option>
                    <option value="diamond">Diamond</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">Size</label>
                  <select
                    aria-label="Node size"
                    [ngModel]="node.props?.size || 'M'"
                    (ngModelChange)="updateSelectedNodeProp('size', $event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                  >
                    <option value="S">Small (S)</option>
                    <option value="M">Medium (M)</option>
                    <option value="L">Large (L)</option>
                  </select>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">Library Icon</label>
                <div class="grid grid-cols-6 gap-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 max-h-36 overflow-y-auto">
                  @for (ic of libraryIcons; track ic) {
                    <button
                      type="button"
                      (click)="updateSelectedNodeField('icon', 'lib:' + ic)"
                      [attr.aria-label]="'Icon ' + ic"
                      class="p-1.5 rounded-lg flex items-center justify-center hover:bg-slate-800 cursor-pointer"
                      [ngClass]="
                        stripIconPrefix(node.icon) === ic
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                          : 'text-slate-300'
                      "
                    >
                      <span class="material-symbols-outlined text-base">{{ ic }}</span>
                    </button>
                  }
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">
                  Custom Image URL (proxied via /api/v1/image-proxy)
                </label>
                <input
                  type="url"
                  aria-label="Custom icon HTTPS URL"
                  placeholder="https://example.com/icon.svg"
                  [ngModel]="node.props?.customIconUrl || ''"
                  (ngModelChange)="updateSelectedNodeProp('customIconUrl', $event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div class="flex items-center justify-between pt-1">
                <label class="text-[11px] font-semibold text-slate-300">Label Position</label>
                <select
                  aria-label="Label position"
                  [ngModel]="node.props?.labelPosition || 'inside'"
                  (ngModelChange)="updateSelectedNodeProp('labelPosition', $event)"
                  class="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 cursor-pointer"
                >
                  <option value="inside">Inside block</option>
                  <option value="below">Below block</option>
                </select>
              </div>

              <label class="flex items-center justify-between cursor-pointer pt-1">
                <span class="text-[11px] font-semibold text-slate-300">Show live counter badge</span>
                <input
                  type="checkbox"
                  [ngModel]="node.props?.showCounter !== false"
                  (ngModelChange)="updateSelectedNodeProp('showCounter', $event)"
                  class="rounded border-slate-700"
                />
              </label>

              <div class="pt-3 border-t border-slate-800">
                <button
                  type="button"
                  (click)="saveNodeAsCustomBlock()"
                  class="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-sky-300 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span class="material-symbols-outlined text-sm">bookmark_add</span>
                  <span>Save as My Block</span>
                </button>
              </div>
            }

            @if (nodeInspectorTab() === 'behaviour') {
              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">Flow Role</label>
                <select
                  aria-label="Node flow role"
                  [ngModel]="node.props?.role || 'normal'"
                  (ngModelChange)="updateSelectedNodeProp('role', $event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                >
                  <option value="start">Start (spawns trace)</option>
                  <option value="normal">Normal checkpoint</option>
                  <option value="decision">Decision branch</option>
                  <option value="success">Success terminal (Paid / Complete)</option>
                  <option value="failure">Failure terminal (Error / Declined)</option>
                  <option value="abandon">Abandon terminal (Cart / Idle)</option>
                  <option value="end">Generic End</option>
                </select>
              </div>

              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">
                  Idle Abandon Timeout (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  aria-label="Idle abandon timeout in minutes"
                  placeholder="e.g. 30"
                  [ngModel]="node.props?.idleAbandonMinutes ?? null"
                  (ngModelChange)="updateSelectedNodeProp('idleAbandonMinutes', $event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">
                  Expected Hold Time at Block (ms)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60000"
                  aria-label="Expected hold time in milliseconds"
                  [ngModel]="node.props?.holdTimeMs ?? 80"
                  (ngModelChange)="updateSelectedNodeProp('holdTimeMs', $event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                />
              </div>
            }

            @if (nodeInspectorTab() === 'integration') {
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-semibold text-slate-300">Send Checkpoint Code</span>
                  <div class="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    @for (lang of ['curl', 'java', 'node', 'python', 'udp']; track lang) {
                      <button
                        type="button"
                        (click)="snippetLang.set($any(lang))"
                        class="px-2 py-0.5 rounded text-[10px] font-mono uppercase cursor-pointer"
                        [ngClass]="
                          snippetLang() === lang
                            ? 'bg-sky-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        "
                      >
                        {{ lang }}
                      </button>
                    }
                  </div>
                </div>

                <div class="relative">
                  <pre class="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10.5px] text-sky-200 overflow-x-auto leading-relaxed">{{ currentSnippet() }}</pre>
                  <button
                    type="button"
                    (click)="copySnippetToClipboard()"
                    class="absolute top-2 right-2 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-200 cursor-pointer"
                  >
                    Copy
                  </button>
                </div>

                <button
                  type="button"
                  (click)="sendTestEventForSelectedBlock()"
                  class="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span class="material-symbols-outlined text-sm">bolt</span>
                  <span>Send test event for "{{ node.key }}"</span>
                </button>

                <div class="pt-3 border-t border-slate-800 space-y-1.5">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="font-semibold text-slate-300">Recent Events (Last 5)</span>
                    <span class="font-mono text-slate-400">{{ keyUsageCount24h() }} in 24h</span>
                  </div>
                  @if (keyRecentEvents().length === 0) {
                    <p class="text-[11px] text-slate-400 py-2">
                      No real events recorded for "{{ node.key }}" yet. Click "Send test event" above.
                    </p>
                  } @else {
                    <div class="space-y-1">
                      @for (ev of keyRecentEvents(); track ev.traceId + ev.timestampMs) {
                        <div class="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-[10px]">
                          <span class="text-slate-200 truncate">{{ ev.traceId }}</span>
                          <span
                            class="px-1.5 py-0.5 rounded"
                            [ngClass]="
                              ev.status === 'error'
                                ? 'bg-rose-950 text-rose-300'
                                : 'bg-emerald-950 text-emerald-300'
                            "
                          >
                            {{ ev.eventType }}
                          </span>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            @if (nodeInspectorTab() === 'advanced') {
              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">
                  Block JSON Inspector (Read-Only)
                </label>
                <pre class="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10.5px] text-slate-300 overflow-x-auto">{{ node | json }}</pre>
              </div>
            }
          </div>
        }

        <!-- CASE 2: Single Connection (Edge) Selected (Section 7.2) -->
        @else if (selectedSingleEdge(); as edge) {
          <div class="p-3 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div class="text-xs font-bold text-slate-100">Connection Properties</div>
              <div class="text-[10px] font-mono text-slate-400">
                {{ edge.source }} → {{ edge.target }}
              </div>
            </div>
            <button
              type="button"
              (click)="deleteSelectedElements()"
              aria-label="Delete connection"
              class="p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 cursor-pointer"
            >
              <span class="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>

          <div class="grid grid-cols-3 border-b border-slate-800 bg-slate-950/50 text-[11px] font-medium">
            @for (tab of ['general', 'style', 'flow']; track tab) {
              <button
                type="button"
                (click)="edgeInspectorTab.set($any(tab))"
                class="py-2 text-center capitalize border-b-2 cursor-pointer"
                [ngClass]="
                  edgeInspectorTab() === tab
                    ? 'border-sky-500 text-sky-400 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                "
              >
                {{ tab === 'flow' ? 'Flow rules' : tab }}
              </button>
            }
          </div>

          <div class="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
            @if (edgeInspectorTab() === 'general') {
              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">
                  Edge Label (shown on canvas)
                </label>
                <input
                  type="text"
                  aria-label="Connection label"
                  placeholder="e.g. 200 OK, Paid, Retry"
                  [ngModel]="edge.label || ''"
                  (ngModelChange)="updateSelectedEdgeLabel($event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-slate-400">Source Block</span>
                  <button
                    type="button"
                    (click)="selectSingleNode(edge.source || edge.from || '')"
                    class="font-mono text-sky-400 hover:underline cursor-pointer"
                  >
                    {{ edge.source || edge.from }}
                  </button>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-slate-400">Target Block</span>
                  <button
                    type="button"
                    (click)="selectSingleNode(edge.target || edge.to || '')"
                    class="font-mono text-sky-400 hover:underline cursor-pointer"
                  >
                    {{ edge.target || edge.to }}
                  </button>
                </div>
              </div>

              @if (edge.status === 'discovered') {
                <div class="p-3 rounded-xl bg-amber-950/50 border border-amber-700/60 space-y-2">
                  <div class="text-[11px] text-amber-200 font-semibold">
                    Auto-discovered from live traffic
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      (click)="resolveDiscoveredEdge(true)"
                      class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      (click)="resolveDiscoveredEdge(false)"
                      class="flex-1 py-1.5 rounded-lg bg-rose-950 border border-rose-700 text-rose-200 font-semibold text-xs cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              }
            }

            @if (edgeInspectorTab() === 'style') {
              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">Path Geometry</label>
                <select
                  aria-label="Connection path style"
                  [ngModel]="edge.style?.type || 'curved'"
                  (ngModelChange)="updateSelectedEdgeStyle('type', $event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                >
                  <option value="curved">Curved Bezier</option>
                  <option value="straight">Straight Line</option>
                  <option value="step">Orthogonal Step</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">Color</label>
                  <select
                    aria-label="Connection color"
                    [ngModel]="edge.style?.color || 'default'"
                    (ngModelChange)="updateSelectedEdgeStyle('color', $event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                  >
                    <option value="default">Default Slate</option>
                    <option value="success">Success Emerald</option>
                    <option value="warn">Warning Amber</option>
                    <option value="error">Error Rose</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">Thickness</label>
                  <select
                    aria-label="Connection thickness"
                    [ngModel]="edge.style?.thickness || 'normal'"
                    (ngModelChange)="updateSelectedEdgeStyle('thickness', $event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                  >
                    <option value="thin">Thin</option>
                    <option value="normal">Normal</option>
                    <option value="thick">Thick</option>
                    <option value="volume">By Volume</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">Direction</label>
                  <select
                    aria-label="Connection direction"
                    [ngModel]="edge.style?.direction || 'one-way'"
                    (ngModelChange)="updateSelectedEdgeStyle('direction', $event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                  >
                    <option value="one-way">One-way (A → B)</option>
                    <option value="bidirectional">Bidirectional (A ↔ B)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">Arrowhead</label>
                  <select
                    aria-label="Connection arrowhead"
                    [ngModel]="edge.style?.arrowhead || 'arrow'"
                    (ngModelChange)="updateSelectedEdgeStyle('arrowhead', $event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                  >
                    <option value="arrow">Standard Arrow</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>

              <label class="flex items-center justify-between cursor-pointer pt-1">
                <span class="text-[11px] font-semibold text-slate-300">Dashed line (async / retry)</span>
                <input
                  type="checkbox"
                  [ngModel]="edge.style?.dashed || false"
                  (ngModelChange)="updateSelectedEdgeStyle('dashed', $event)"
                  class="rounded border-slate-700"
                />
              </label>
            }

            @if (edgeInspectorTab() === 'flow') {
              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">
                  Branch Weight / Probability (0–100%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  aria-label="Branch probability weight"
                  placeholder="Equal split if blank"
                  [ngModel]="edge.flow?.weight ?? null"
                  (ngModelChange)="updateSelectedEdgeFlow('weight', $event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div class="space-y-1.5">
                <label class="block text-[11px] font-semibold text-slate-300">
                  Condition / Outcome Label
                </label>
                <input
                  type="text"
                  aria-label="Branch condition"
                  placeholder="e.g. status == 'ok' or cartTotal > 50"
                  [ngModel]="edge.flow?.condition || ''"
                  (ngModelChange)="updateSelectedEdgeFlow('condition', $event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">
                    Expected Latency (ms)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="30000"
                    aria-label="Expected latency in milliseconds"
                    [ngModel]="edge.flow?.expectedLatencyMs ?? 400"
                    (ngModelChange)="updateSelectedEdgeFlow('expectedLatencyMs', $event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">
                    Animation Speed
                  </label>
                  <select
                    aria-label="Token animation speed multiplier"
                    [ngModel]="edge.flow?.speedMultiplier ?? 1"
                    (ngModelChange)="updateSelectedEdgeFlow('speedMultiplier', +$event)"
                    class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                  >
                    <option [value]="0.5">0.5x (Slow)</option>
                    <option [value]="1">1x (Normal)</option>
                    <option [value]="2">2x (Fast)</option>
                  </select>
                </div>
              </div>

              <label class="flex items-center justify-between cursor-pointer pt-1">
                <span class="text-[11px] font-semibold text-slate-300">
                  Terminal path (trace finishes after this hop)
                </span>
                <input
                  type="checkbox"
                  [ngModel]="edge.flow?.terminal || false"
                  (ngModelChange)="updateSelectedEdgeFlow('terminal', $event)"
                  class="rounded border-slate-700"
                />
              </label>
            }
          </div>
        }

        <!-- CASE 3: Group / Zone Selected (Section 7.3) -->
        @else if (selectedSingleGroup(); as grp) {
          <div class="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-100">Zone / Group</span>
            <button
              type="button"
              (click)="ungroupSelectedZone()"
              class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
            >
              Ungroup
            </button>
          </div>
          <div class="flex-1 p-3.5 space-y-4 text-xs">
            <div class="space-y-1.5">
              <label class="block text-[11px] font-semibold text-slate-300">Zone Name</label>
              <input
                type="text"
                aria-label="Zone name"
                [ngModel]="grp.name"
                (ngModelChange)="renameSelectedGroup($event)"
                class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
              />
            </div>

            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-[11px] font-semibold text-slate-300">Collapse zone contents</span>
              <input
                type="checkbox"
                [ngModel]="grp.collapsed || false"
                (ngModelChange)="toggleSelectedGroupCollapse($event)"
                class="rounded border-slate-700"
              />
            </label>
          </div>
        }

        <!-- CASE 4: Multiple Blocks Selected (Section 7.3) -->
        @else if (selectedNodeKeys().size > 1) {
          <div class="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-100">
              {{ selectedNodeKeys().size }} Blocks Selected
            </span>
            <button
              type="button"
              (click)="clearSelection()"
              class="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div class="flex-1 p-3.5 space-y-4 text-xs">
            @if (selectedNodeKeys().size === 2) {
              <div class="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-700/50 text-[11px] text-emerald-200">
                Highlighting {{ highlightedPath().edgeIds.size }} connection(s) along the path between the 2 selected blocks.
              </div>
            }

            <div>
              <div class="text-[11px] font-semibold text-slate-300 mb-2">Align</div>
              <div class="grid grid-cols-3 gap-1.5">
                @for (al of ['left', 'center', 'right', 'top', 'middle', 'bottom']; track al) {
                  <button
                    type="button"
                    (click)="alignSelectedNodes($any(al))"
                    class="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 capitalize text-slate-200 cursor-pointer"
                  >
                    {{ al }}
                  </button>
                }
              </div>
            </div>

            <div>
              <div class="text-[11px] font-semibold text-slate-300 mb-2">Distribute</div>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  (click)="distributeSelectedNodes('horizontal')"
                  class="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  Horizontal
                </button>
                <button
                  type="button"
                  (click)="distributeSelectedNodes('vertical')"
                  class="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  Vertical
                </button>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                (click)="groupSelectedNodes()"
                class="w-full py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 font-semibold cursor-pointer"
              >
                Group into Zone (Ctrl+G)
              </button>
              <button
                type="button"
                (click)="duplicateSelectedNodes()"
                class="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
              >
                Duplicate (Ctrl+D)
              </button>
              <button
                type="button"
                (click)="deleteSelectedElements()"
                class="w-full py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800 text-rose-200 font-medium cursor-pointer"
              >
                Delete Selected
              </button>
            </div>
          </div>
        }

        <!-- CASE 5: Nothing Selected -> Diagram Settings (Section 7.4) -->
        @else {
          <div class="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-100">Diagram Settings</span>
            <span class="text-[10px] font-mono text-slate-400">Schema v2</span>
          </div>

          <div class="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[11px] font-semibold text-slate-300 mb-1">
                  Default Direction
                </label>
                <select
                  aria-label="Default diagram direction"
                  [ngModel]="diagram().direction || 'LR'"
                  (ngModelChange)="runAutoLayout($event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                >
                  <option value="LR">Left to Right (LR)</option>
                  <option value="TB">Top to Bottom (TB)</option>
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-300 mb-1">
                  Canvas Theme
                </label>
                <select
                  aria-label="Canvas theme preview"
                  [ngModel]="diagram().themePreview || 'dark'"
                  (ngModelChange)="setThemePreview($event)"
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                >
                  <option value="dark">Dark Neon</option>
                  <option value="light">Cozy Light</option>
                </select>
              </div>
            </div>

            <label class="flex items-center justify-between cursor-pointer">
              <span class="text-[11px] font-semibold text-slate-300">
                Auto-discover unknown nodes from live traffic
              </span>
              <input
                type="checkbox"
                [ngModel]="diagram().autoDiscovery !== false"
                (ngModelChange)="setAutoDiscovery($event)"
                class="rounded border-slate-700"
              />
            </label>

            @if (entitlements(); as ent) {
              <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-semibold text-slate-200">Plan Limits ({{ ent.planTier }})</span>
                  <span class="font-mono text-slate-400">
                    {{ diagram().nodes.length }} / {{ ent.maxBlocksPerProject }} blocks
                  </span>
                </div>
                <div class="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    class="h-full bg-sky-500"
                    [style.width.%]="(diagram().nodes.length / ent.maxBlocksPerProject) * 100"
                  ></div>
                </div>
                <div class="text-[10px] font-mono text-slate-400">
                  Connections: {{ diagram().edges.length }} / {{ ent.maxEdgesPerProject }}
                </div>
              </div>
            }

            <div class="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                (click)="showSaveTemplateModal.set(true)"
                class="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span class="material-symbols-outlined text-sm text-sky-400">library_add</span>
                <span>Save as Template</span>
              </button>

              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  (click)="showImportModal.set(true)"
                  class="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
                >
                  Import JSON
                </button>
                <button
                  type="button"
                  (click)="exportDiagramJson()"
                  class="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
                >
                  Export JSON
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Bottom Validation Strip in Inspector -->
        <div class="border-t border-slate-800 bg-slate-950/90">
          <button
            type="button"
            (click)="showValidationDrawer.set(!showValidationDrawer())"
            class="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold cursor-pointer hover:bg-slate-900"
          >
            <div class="flex items-center gap-2">
              <span
                class="material-symbols-outlined text-sm"
                [ngClass]="
                  errorIssues().length > 0
                    ? 'text-rose-400'
                    : warningIssues().length > 0
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                "
              >
                {{ errorIssues().length > 0 ? 'error' : warningIssues().length > 0 ? 'warning' : 'check_circle' }}
              </span>
              <span>
                Validation ({{ errorIssues().length }} errors, {{ warningIssues().length }} warnings)
              </span>
            </div>
            <span class="material-symbols-outlined text-sm text-slate-400">
              {{ showValidationDrawer() ? 'expand_more' : 'expand_less' }}
            </span>
          </button>

          @if (showValidationDrawer()) {
            <div class="max-h-48 overflow-y-auto p-2.5 space-y-1.5 border-t border-slate-800/80 text-[11px]">
              @if (validationIssues().length === 0) {
                <div class="p-2 text-emerald-300 flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-sm">verified</span>
                  <span>All diagram checks passed. Ready to publish.</span>
                </div>
              }
              @for (iss of validationIssues(); track iss.id) {
                <button
                  type="button"
                  (click)="centerOnElement(iss.elementType, iss.elementId)"
                  class="w-full p-2 rounded-lg text-left border transition-colors cursor-pointer"
                  [ngClass]="
                    iss.severity === 'error'
                      ? 'bg-rose-950/40 border-rose-800/60 text-rose-200 hover:bg-rose-950/70'
                      : iss.severity === 'warning'
                        ? 'bg-amber-950/35 border-amber-800/50 text-amber-200 hover:bg-amber-950/60'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                  "
                >
                  <div class="font-semibold">{{ iss.message }}</div>
                  @if (iss.fixHint) {
                    <div class="text-[10px] opacity-80 mt-0.5">{{ iss.fixHint }}</div>
                  }
                </button>
              }
            </div>
          }
        </div>
      </aside>
    }
  </div>

  <!-- MODAL 1: Command Palette (Ctrl+K) -->
  @if (showCommandPalette()) {
    <div
      class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-start justify-center pt-20 p-4"
      (click)="showCommandPalette.set(false)"
    >
      <div
        class="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="p-3 border-b border-slate-800 flex items-center gap-2">
          <span class="material-symbols-outlined text-sky-400">terminal</span>
          <input
            type="text"
            aria-label="Command palette search"
            placeholder="Type a block name to add to canvas..."
            [ngModel]="librarySearch()"
            (ngModelChange)="librarySearch.set($event)"
            class="flex-1 bg-transparent text-xs text-slate-100 focus:outline-none"
          />
          <button
            type="button"
            (click)="showCommandPalette.set(false)"
            class="text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            Esc
          </button>
        </div>
        <div class="max-h-72 overflow-y-auto p-2 space-y-1">
          @for (pack of filteredCatalogPacks(); track pack.pack) {
            @for (blk of pack.blocks; track blk.id) {
              <button
                type="button"
                (click)="addBlockFromCatalog(blk)"
                class="w-full px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between text-left text-xs cursor-pointer"
              >
                <div class="flex items-center gap-2.5">
                  <span class="material-symbols-outlined text-base" [style.color]="blk.tint">
                    {{ stripIconPrefix(blk.icon) }}
                  </span>
                  <span class="font-medium text-slate-100">{{ blk.name }}</span>
                </div>
                <span class="font-mono text-[10px] text-slate-400">{{ pack.title }} · {{ blk.keyPattern }}</span>
              </button>
            }
          }
        </div>
      </div>
    </div>
  }

  <!-- MODAL 2: Publish Diagram Modal (Section 9.2) -->
  @if (showPublishModal()) {
    <div
      class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      (click)="showPublishModal.set(false)"
    >
      <div
        class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-100">Publish Diagram to Live View</h3>
          <button
            type="button"
            (click)="showPublishModal.set(false)"
            aria-label="Close publish modal"
            class="text-slate-400 hover:text-white cursor-pointer"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">
          Publishing creates an immutable diagram version ({{ baseVersion() + 1 }}) and switches live traffic rendering immediately.
        </p>

        @if (warningIssues().length > 0) {
          <div class="p-3 rounded-xl bg-amber-950/40 border border-amber-700/60 text-xs text-amber-200">
            {{ warningIssues().length }} warning(s) present. You can still publish, or review them in the Validation drawer.
          </div>
        }

        <div class="space-y-1.5">
          <label class="block text-[11px] font-semibold text-slate-300">Change Summary</label>
          <input
            type="text"
            aria-label="Publish change summary"
            placeholder="e.g. Added payment retry branch and fraud check"
            [ngModel]="publishSummary()"
            (ngModelChange)="publishSummary.set($event)"
            class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100"
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            (click)="showPublishModal.set(false)"
            class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            [disabled]="publishing()"
            (click)="confirmPublish()"
            class="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
          >
            {{ publishing() ? 'Publishing...' : 'Publish now' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- MODAL 3: Version History Modal (Section 9.3) -->
  @if (showVersionsModal()) {
    <div
      class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      (click)="showVersionsModal.set(false)"
    >
      <div
        class="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-100">Published Diagram Versions</h3>
          <button
            type="button"
            (click)="showVersionsModal.set(false)"
            aria-label="Close versions modal"
            class="text-slate-400 hover:text-white cursor-pointer"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <div class="max-h-72 overflow-y-auto space-y-2">
          @for (ver of versions(); track ver.version) {
            <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div>
                <div class="font-bold text-slate-100">
                  v{{ ver.version }} · {{ ver.changeSummary || 'Published diagram' }}
                </div>
                <div class="text-[11px] text-slate-400 font-mono">
                  {{ ver.authorEmail || 'system' }} · {{ ver.graph.nodes.length }} blocks · {{ ver.graph.edges.length }} edges
                </div>
              </div>
              <button
                type="button"
                (click)="restoreVersionToDraft(ver.version)"
                class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-medium cursor-pointer shrink-0"
              >
                Restore to draft
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  }

  <!-- MODAL 4: Keyboard Connect Picker (Accessibility Section 11) -->
  @if (showConnectModal() && selectedSingleNode(); as srcNode) {
    <div
      class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      (click)="showConnectModal.set(false)"
    >
      <div
        class="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-4 shadow-2xl space-y-3"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-100">
            Connect "{{ srcNode.label }}" to...
          </h3>
          <button
            type="button"
            (click)="showConnectModal.set(false)"
            aria-label="Close connect picker"
            class="text-slate-400 hover:text-white cursor-pointer"
          >
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        <div class="max-h-60 overflow-y-auto space-y-1">
          @for (target of diagram().nodes; track target.key) {
            <button
              type="button"
              (click)="createConnection(srcNode.key, target.key); showConnectModal.set(false)"
              class="w-full px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between text-xs text-slate-200 cursor-pointer"
            >
              <span>{{ target.label }}</span>
              <span class="font-mono text-[10px] text-slate-400">{{ target.key }}</span>
            </button>
          }
        </div>
      </div>
    </div>
  }

  <!-- MODAL 5: Save as Template Modal (Section 7.4) -->
  @if (showSaveTemplateModal()) {
    <div
      class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      (click)="showSaveTemplateModal.set(false)"
    >
      <div
        class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4"
        (click)="$event.stopPropagation()"
      >
        <h3 class="text-sm font-bold text-slate-100">Save Diagram as Reusable Template</h3>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1">Template Title</label>
            <input
              type="text"
              aria-label="Template title"
              placeholder="e.g. Multi-Region Checkout Pipeline"
              [ngModel]="templateTitle()"
              (ngModelChange)="templateTitle.set($event)"
              class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1">Summary</label>
            <textarea
              rows="2"
              aria-label="Template summary"
              [ngModel]="templateSummary()"
              (ngModelChange)="templateSummary.set($event)"
              class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100"
            ></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            (click)="showSaveTemplateModal.set(false)"
            class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            (click)="saveDiagramAsTemplate()"
            class="px-4 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs cursor-pointer"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  }

  <!-- MODAL 6: Import JSON Modal (Section 7.4) -->
  @if (showImportModal()) {
    <div
      class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      (click)="showImportModal.set(false)"
    >
      <div
        class="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-3"
        (click)="$event.stopPropagation()"
      >
        <h3 class="text-sm font-bold text-slate-100">Import Diagram JSON (max 2 MB)</h3>
        <textarea
          rows="8"
          aria-label="Paste diagram JSON"
          placeholder='{"schema": 2, "direction": "LR", "nodes": [...], "edges": [...]}'
          [ngModel]="importJsonText()"
          (ngModelChange)="importJsonText.set($event)"
          class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-100"
        ></textarea>
        @if (importError()) {
          <p class="text-xs text-rose-400">{{ importError() }}</p>
        }
        <div class="flex justify-end gap-2">
          <button
            type="button"
            (click)="showImportModal.set(false)"
            class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            (click)="confirmImportJson()"
            class="px-4 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs cursor-pointer"
          >
            Validate & Import
          </button>
        </div>
      </div>
    </div>
  }

  <!-- MODAL 7: Keyboard Shortcuts Help (?) -->
  @if (showShortcutsModal()) {
    <div
      class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      (click)="showShortcutsModal.set(false)"
    >
      <div
        class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-3"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-100">Editor Keyboard Shortcuts</h3>
          <button
            type="button"
            (click)="showShortcutsModal.set(false)"
            aria-label="Close shortcuts modal"
            class="text-slate-400 hover:text-white cursor-pointer"
          >
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs text-slate-300">
          <div><kbd class="px-1.5 py-0.5 rounded bg-slate-800 font-mono">Ctrl+K</kbd> Add block</div>
          <div><kbd class="px-1.5 py-0.5 rounded bg-slate-800 font-mono">Ctrl+Enter</kbd> Preview flow</div>
          <div><kbd class="px-1.5 py-0.5 rounded bg-slate-800 font-mono">Ctrl+Z / ⇧Z</kbd> Undo / Redo</div>
          <div><kbd class="px-1.5 py-0.5 rounded bg-slate-800 font-mono">Ctrl+D</kbd> Duplicate</div>
          <div><kbd class="px-1.5 py-0.5 rounded bg-slate-800 font-mono">Ctrl+G</kbd> Group zone</div>
          <div><kbd class="px-1.5 py-0.5 rounded bg-slate-800 font-mono">Ctrl+S</kbd> Save draft</div>
          <div><kbd class="px-1.5 py-0.5 rounded bg-slate-800 font-mono">0 / F</kbd> Fit screen / selection</div>
          <div><kbd class="px-1.5 py-0.5 rounded bg-slate-800 font-mono">Space+Drag</kbd> Pan canvas</div>
        </div>
      </div>
    </div>
  }
</div>
`;


