import styles from './Button.module.scss';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'google';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function Button({ 
  children, 
  onClick, 
  variant = 'primary',
  type = 'button',
  disabled = false,
  className = '',
  ariaLabel
}: ButtonProps) {
  return (
    <button 
      className={`${styles.button} ${styles[variant]} ${className}`}
      onClick={onClick}
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
