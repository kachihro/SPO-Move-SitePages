import * as React from "react";
import { makeStyles, mergeClasses, Spinner } from "@fluentui/react-components";
import { heroButtonGradient, heroButtonGradientHover } from "./theme";

const useStyles = makeStyles({
  root: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "999px",
    border: "none",
    paddingLeft: "28px",
    paddingRight: "28px",
    paddingTop: "10px",
    paddingBottom: "10px",
    minHeight: "40px",
    fontWeight: 600,
    fontSize: "15px",
    fontFamily: "inherit",
    lineHeight: "1.2",
    gap: "8px",
    cursor: "pointer",
    // Avoid Fluent primary solid fill winning over the gradient on Power Pages.
    backgroundColor: "transparent",
    backgroundImage: heroButtonGradient,
    color: "#ffffff",
    boxShadow: "0 4px 14px rgba(194, 38, 114, 0.35)",
    transitionProperty: "background-image, box-shadow, transform",
    transitionDuration: "120ms",
    ":hover": {
      backgroundImage: heroButtonGradientHover,
      color: "#ffffff",
      boxShadow: "0 6px 18px rgba(168, 31, 98, 0.4)",
    },
    ":active": {
      backgroundImage: heroButtonGradientHover,
      transform: "translateY(1px)",
    },
    ":disabled": {
      cursor: "not-allowed",
      opacity: 0.55,
      backgroundImage: "none",
      backgroundColor: "#C8C6C4",
      boxShadow: "none",
      color: "#ffffff",
    },
  },
  // Keep the gradient while working — a greyed-out button under a spinner reads as "dead", not "busy".
  loading: {
    ":disabled": {
      opacity: 1,
      backgroundColor: "transparent",
      backgroundImage: heroButtonGradient,
      cursor: "progress",
    },
  },
});

export interface HeroButtonProps {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Show an inline spinner beside the label and block further clicks while the action runs. */
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

/** Pink→magenta gradient pill used for primary CTAs (Create, Next, Save Draft, Submit). */
export const HeroButton: React.FC<HeroButtonProps> = (props) => {
  const styles = useStyles();
  const loading = !!props.loading;
  return (
    <button
      type={props.type ?? "button"}
      className={mergeClasses(styles.root, loading && styles.loading, props.className)}
      disabled={!!props.disabled || loading}
      aria-busy={loading ? true : undefined}
      onClick={props.onClick}
    >
      {loading && <Spinner size="tiny" appearance="inverted" />}
      {props.children}
    </button>
  );
};
