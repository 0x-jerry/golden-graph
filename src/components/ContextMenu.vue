<script setup lang="ts">
import type { Placement } from "@floating-ui/vue";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/vue";
import { onClickOutside } from "@vueuse/core";
import { type Component, computed, ref } from "vue";

export interface ContextMenuItem {
  key?: string | number;
  label: string;
  icon?: string | Component;
  disabled?: boolean;
  /**
   * Keyboard shortcut
   */
  shortcut?: string;
  action?: () => void;
  children?: ContextMenuItem[];
}

export interface ContextMenuProps {
  items?: ContextMenuItem[];
  /**
   * The x coordinate for the root menu
   */
  x?: number;
  /**
   * The y coordinate for the root menu
   */
  y?: number;
  /**
   * The reference element for submenus
   */
  parentElement?: HTMLElement | null;
  visible?: boolean;
  placement?: Placement;
}

export interface ContextMenuEmits {
  (e: "close"): void;
  (e: "click", item: ContextMenuItem): void;
}

const props = withDefaults(defineProps<ContextMenuProps>(), {
  items: () => [],
  x: 0,
  y: 0,
  visible: false,
  placement: "right-start",
});

const emit = defineEmits<ContextMenuEmits>();

const reference = computed(() => {
  if (props.parentElement) {
    return props.parentElement;
  }

  const boundingRect = {
    width: 0,
    height: 0,
    x: props.x,
    y: props.y,
    top: props.y,
    left: props.x,
    right: props.x,
    bottom: props.y,
  }

  // Virtual element for root
  return {
    getBoundingClientRect() {
      return boundingRect;
    },
  };
});

const floating = ref<HTMLElement>();

const middleware = computed(() => {
  if (props.parentElement) {
    // Submenu settings
    return [offset(4), flip(), shift({ padding: 10 })];
  }

  // Root menu settings
  return [
    offset(4),
    flip({
      fallbackPlacements: [
        "bottom-start",
        "top-start",
        "right-start",
        "left-start",
      ],
    }),
    shift({ padding: 10 }),
  ];
});

const { floatingStyles } = useFloating(reference, floating, {
  placement: () => (props.parentElement ? "right-start" : "bottom-start"),
  whileElementsMounted: autoUpdate,
  middleware,
});

if (!props.parentElement) {
  onClickOutside(
    floating,
    () => {
      if (props.visible) {
        handleClose()
      }
    },
    {
      ignore: [".context-menu"],
    }
  );
}

const activeIndex = ref<number | null>(null);
const itemRefs = ref<HTMLElement[]>([]);

// Handle hover for submenus
function handleMouseEnter(index: number) {
  if (props.items[index].disabled) return;
  activeIndex.value = index;
}

function handleMouseLeave() {
  // We might want a delay here, but for simplicity, keep it simple for now.
  // If we close immediately, moving to submenu might fail if there's a gap.
  // But our offset is small.
  // Usually, we only close if we hover another item.
  // But if we leave the menu entirely?
  // For now, let's not auto-close on simple mouseleave of the item unless we enter another.
}

function handleClick(item: ContextMenuItem) {
  if (item.disabled) return;

  if (item.children?.length) {
    // Usually clicking a submenu parent just opens it (which hover already does)
    // or does nothing.
    return;
  }

  item.action?.();
  emit("click", item);

  handleClose();
}

function handleClose() {
  activeIndex.value = null;
  emit("close");
}

function handleSubMenuClose() {
  activeIndex.value = null;
}

function handleSubMenuClick(item: ContextMenuItem) {
  emit("click", item);

  handleClose();
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="floating"
      class="context-menu"
      :style="floatingStyles"
      @contextmenu.prevent
    >
      <div
        v-for="(item, index) in items"
        :key="item.key ?? index"
        ref="itemRefs"
        class="context-menu-item"
        :class="{ disabled: item.disabled, active: activeIndex === index }"
        @mouseenter="handleMouseEnter(index)"
        @mouseleave="handleMouseLeave"
        @click.stop="handleClick(item)"
      >
        <div class="icon">
          <component :is="item.icon" v-if="item.icon" />
        </div>

        <span class="label">{{ item.label }}</span>

        <span v-if="item.shortcut" class="shortcut">{{ item.shortcut }}</span>

        <div class="arrow" v-if="item.children && item.children.length">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>

        <!-- Submenu -->
        <ContextMenu
          v-if="item.children && activeIndex === index"
          :items="item.children"
          :parent-element="itemRefs[index]"
          :visible="true"
          @close="handleSubMenuClose"
          @click="handleSubMenuClick"
        />
      </div>
    </div>
  </Teleport>
</template>

<style lang="less">
.context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 180px;
  padding: 4px;
  background: var(--gr-color-surface, #1e1e1e);
  border: 1px solid var(--gr-color-border, #333);
  border-radius: 6px;
  box-shadow: var(
    --gr-color-context-menu-shadow,
    0 4px 12px rgba(0, 0, 0, 0.3)
  );
  color: var(--gr-color-text-primary, #e0e0e0);
  font-size: 13px;
  user-select: none;

  .context-menu-item {
    display: flex;
    align-items: center;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.1s;
    position: relative;

    &:hover,
    &.active {
      background-color: var(--gr-color-accent, #007acc);
      color: #ffffff;
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      &:hover {
        background-color: transparent;
        color: inherit;
      }
    }

    .icon {
      width: 16px;
      height: 16px;
      margin-right: 8px;
      display: flex;
      align-items: center;
      justify-content: center;

      svg {
        width: 100%;
        height: 100%;
      }
    }

    .label {
      flex: 1;
      white-space: nowrap;
    }

    .shortcut {
      margin-left: 16px;
      font-size: 11px;
      color: var(--gr-color-text-muted, rgba(224, 224, 224, 0.7));
    }

    .arrow {
      margin-left: 8px;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;

      svg {
        width: 100%;
        height: 100%;
      }
    }
  }
}
</style>
