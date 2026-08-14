import "server-only";

/**
 * Images that ship inside the email itself.
 *
 * Base64 in source rather than a file in public/: remote <img> src is blocked by
 * default in Gmail and Outlook until the reader clicks "display images", and
 * data: URIs are stripped outright. A cid: attachment is the only form that
 * renders on first open, and inlining the bytes here keeps them in the bundle
 * so serverless builds don't have to trace a file off disk.
 */

/**
 * The WhatsApp mark, white on #128C4A so it sits flush inside the join button.
 * 36x36, drawn at 18 CSS px for sharpness on retina screens.
 *
 * Source glyph: simple-icons (CC0). The mark itself is Meta's trademark — used
 * here only to label a link to our own WhatsApp group, which is what it's for.
 */
export const WHATSAPP_ICON_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAMAAADW3miqAAAB71BMVEX////5/PoTjEv7/fzp9O79/v0gk1USjEr+/v71+vdHpnP8/fw+oWzz+fb4+/qSyquXzLDI5NWPyKnn8+3k8usckFGNx6gWjk1FpHGv2MGu18F4vZi43MmMx6dis4eHxKMxm2Lk8eojlFcvmmBjs4gnllodkVLM5tgtmV+53cns9fD6/PtXrX9st44ql1z3+/nC4dCw2cOq1b4akFCazrLK5daTyqx9wJzy+fVRqnoumWBesITZ7OJuuZD0+vdCo27l8uvm8+xntYup1b1zu5Tu9vLY7OGo1bx3vZfi8eiz2sV+wJ3J5NWm1Lv2+vgllVhOqXhLp3ZotYzd7uWFw6IekVNar4GYzbDW69/e7+aVzK40nGSs1r+93sw5nmfQ6NtWrX6/4M7x+PU4nmfR6NzH49RIpnOh0bcfklTD4tHL5tfV6t/q9e9Yrn9PqXjN59khk1a228dGpXJZroCIxaTw9/MsmV5br4IZj09Bo27U6t6r1r+x2cTE4tJ2vJa83suk07qDw6Aym2JcsILX7OEilFZxupNdsIPt9vFfsYTT6d17vprv9/Lb7eS02sZ0u5XX6+BDo2+33MhEpHBhsoZ5vpjf7+ZQqnkXjk6l07osmF2i0bgYj06Lx6Y1nWQznGMVjUxUrH2+3848oGrF49LzMSrpAAAACXBIWXMAAAsTAAALEwEAmpwYAAACB0lEQVQ4y72U51vUQBDG36tJrnHHcY0ivYNIlSZIB3uvgGDvXbCDCkpR7L2i/qHO5jZlc/A8ftH5kNmd/SXZeXdmIf2F4R9B8fSQ06YcDAUvxlaBYs8zoFvfg8hK0PtntCYfqd1/qK7RQcNwUSo0SAvvetcmJ7PdC4Sl2y1QGqC8/WD8wd49ByTsAlQNdL0UU8p7AXw1Q3EbnK3WxN39kNtMUCMCV1Pl+d6HoS861AZEyXmcAY9AbQAWdSiEitOSVBIGsgXoRzs2alCxC2nk1lDW3kKB6gU6OURfPUluM1M6V4A+ybjOoVPwM0GKiHHtEPc+gyscGkc7CxRsI5EtCU7hEofOYp2merkFmkYGh07gjBqJ7AbWi9AdNT0GZeNAMuTzQ65mg7I8Dt3DbQ41obI+GdtXCTTslYrzvZk+NdCFuxwigVr4m1UKUJFTyiori6a3gPscctvwUduER6/OPTSLQp7QjmUJNWX62QdrVMZ/mES5gVL97OLAgJHR9qwtipI5SqMgMGaUihM/V+ikSRcXUIW+pejDrLMZR48Z0CDwK4V5o8B1zVS+rxCWIstNnx8aSGuPDMdjU7fEmjH020YZORJPLrNgyfxAAHjaYu67nUlhvOoz//i588zLiUKhOXMo1t/wyO3r6dCU7Kh9bbkLNm3dxTu3viq3rnxkOHrh5n+5n1axPx4bWM/GRCvKAAAAAElFTkSuQmCC",
  "base64",
);
