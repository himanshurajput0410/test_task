"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useCallback } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { z } from "zod";
import DOMPurify from "dompurify";
import validator from "validator";
import Button from "@/components/Button";
import styles from "./page.module.scss";

type FieldErrors = Partial<
  Record<
    | "firstname"
    | "lastname"
    | "email"
    | "password"
    | "mobile"
    | "dob"
    | "terms"
    | "privacy",
    string
  >
>;

const signupSchema = z.object({
  firstname: z.string().min(2, "First name must be at least 2 characters.").max(50, "First name is too long."),
  lastname: z.string().min(2, "Last name must be at least 2 characters.").max(50, "Last name is too long."),
  email: z.string().email("Enter a valid email address.").max(100, "Email is too long."),
  mobile: z.string().min(10, "Enter a valid mobile number.").max(15, "Mobile number is too long."),
  password: z.string().min(6, "Password must be at least 6 characters.").max(100, "Password is too long."),
  dob: z.string().min(1, "DOB is required."),
  terms: z.boolean().refine((val) => val === true, "Please accept Terms of Service."),
  privacy: z.boolean().refine((val) => val === true, "Please accept Privacy Policy."),
});

function sanitizeInput(input: string): string {
  if (typeof window !== "undefined") {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  }
  return input.replace(/<[^>]*>/g, ""); 
}

function isEmail(value: string): boolean {
  return validator.isEmail(value.trim());
}

function isValidMobile(value: string): boolean {
  const digits = value.replace(/\D+/g, "");
  return validator.isMobilePhone(digits, "any", { strictMode: false }) || digits.length >= 10;
}

function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

async function sha256Hex(value: string) {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("Crypto API is not available. Please use HTTPS or a modern browser.");
  }

  try {
    const enc = new TextEncoder().encode(value);
    const hash = await window.crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    throw new Error("Failed to encrypt password. Please try again.");
  }
}

export default function SignupPage() {
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof FieldErrors, boolean>>
  >({});

  const resetForm = useCallback(() => {
    setFirstname("");
    setLastname("");
    setEmail("");
    setMobile("");
    setPassword("");
    setDob("");
    setTerms(false);
    setPrivacy(false);
    setErrors({});
    setTouched({});
  }, []);

  const validateField = useCallback((fieldName: keyof FieldErrors): string | undefined => {
    try {
      const sanitizedData = {
        firstname: sanitizeInput(firstname.trim()),
        lastname: sanitizeInput(lastname.trim()),
        email: sanitizeInput(email.trim()),
        mobile: onlyDigits(mobile),
        password: password, 
        dob: sanitizeInput(dob.trim()),
        terms,
        privacy,
      };

      const result = signupSchema.safeParse(sanitizedData);
      
      if (!result.success) {
        const fieldError = result.error.issues.find((issue) => issue.path[0] === fieldName);
        return fieldError?.message;
      }

      switch (fieldName) {
        case "email": {
          if (!isEmail(sanitizedData.email)) {
            return "Enter a valid email address.";
          }
          break;
        }
        case "mobile": {
          if (!isValidMobile(mobile)) {
            return "Enter a valid mobile number.";
          }
          break;
        }
      }

      return undefined;
    } catch {
      return "Validation error occurred.";
    }
  }, [firstname, lastname, email, mobile, password, dob, terms, privacy]);

  const handleFieldChange = useCallback((
    field: "firstname" | "lastname" | "email",
    value: string
  ) => {
    const sanitized = sanitizeInput(value);
    const setters = {
      firstname: setFirstname,
      lastname: setLastname,
      email: setEmail,
    };
    setters[field](sanitized);
    if (touched[field]) {
      const error = validateField(field);
      setErrors((p) => ({ ...p, [field]: error }));
    }
  }, [touched, validateField]);

  const handleFieldBlur = useCallback((field: keyof FieldErrors) => {
    setTouched((p) => ({ ...p, [field]: true }));
    const error = validateField(field);
    setErrors((p) => ({ ...p, [field]: error }));
  }, [validateField]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);
    
    setTouched({
      firstname: true,
      lastname: true,
      email: true,
      mobile: true,
      password: true,
      dob: true,
      terms: true,
      privacy: true,
    });

    setSubmitting(true);
    try {
      const sanitizedData = {
        firstname: sanitizeInput(firstname.trim()),
        lastname: sanitizeInput(lastname.trim()),
        email: sanitizeInput(email.trim()),
        mobile: onlyDigits(mobile),
        dob: sanitizeInput(dob.trim()),
      };

      const validationResult = signupSchema.safeParse({
        ...sanitizedData,
        password,
        terms,
        privacy,
      });

      if (!validationResult.success) {
        const validationErrors: FieldErrors = {};
        validationResult.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof FieldErrors;
          if (field) {
            validationErrors[field] = issue.message;
          }
        });
        setErrors(validationErrors);
        setSubmitting(false);
        return;
      }

      const encryptpassword = await sha256Hex(password);
      
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstname: sanitizedData.firstname,
          lastname: sanitizedData.lastname,
          email: sanitizedData.email,
          encryptpassword,
          mobile: sanitizedData.mobile,
          dob: sanitizedData.dob,
        }),
      });

      const responseData = await res.json();
      
      if (responseData.success === true && responseData.status === 200) {
        setSuccessMsg(responseData.message || "Account created successfully!");
        resetForm();
        return;
      }
      
      if (responseData.error || !responseData.success) {
        throw new Error(
          responseData.error ||
            responseData.message ||
            "Registration failed. Please try again."
        );
      }
      
      if (responseData.status === 200) {
        setSuccessMsg(responseData.message || "Account created successfully!");
        resetForm();
        return;
      }

      throw new Error("Unexpected response from server. Please try again.");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setFormError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.canvas}>
        <section>
          <div className={styles.topBar}>
            <Link href="/" className={styles.brand} aria-label="Atologist Infotech">
              <Image
                src="/assets/atologist-infotech.png"
                alt="Atologist Infotech"
                width={209}
                height={74}
                priority
                quality={90}
                className={styles.brandLogo}
              />
            </Link>

            <div className={styles.topRight}>
              Already have an account?
              <Link href="/">Sign In</Link>
            </div>
          </div>
          <div className={styles.left}>
          <h1 className={styles.title}>Welcome To Atologist Infotech</h1>
          <p className={styles.subtitle}>Create your account</p>

          <button
            type="button"
            className={styles.googleBtn}
            aria-label="Continue with Google"
            onClick={() => {
              setSuccessMsg(null);
              setFormError("Google sign-in is not configured yet.");
            }}
          >
            <Image
              src="/assets/google-icon.png"
              alt="Google"
              width={40}
              height={40}
              priority
              quality={90}
              className={styles.googleIcon}
            />
          </button>

          <div className={styles.divider}>OR</div>

          <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="firstname">
                First Name
              </label>
              <input
                id="firstname"
                name="firstname"
                className={styles.input}
                placeholder="Enter your first name"
                value={firstname}
                onChange={(e) => handleFieldChange("firstname", e.target.value)}
                onBlur={() => handleFieldBlur("firstname")}
                autoComplete="given-name"
              />
              {touched.firstname && errors.firstname ? (
                <div className={styles.errorText}>{errors.firstname}</div>
              ) : null}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="lastname">
                Last Name
              </label>
              <input
                id="lastname"
                name="lastname"
                className={styles.input}
                placeholder="Enter your last name"
                value={lastname}
                onChange={(e) => handleFieldChange("lastname", e.target.value)}
                onBlur={() => handleFieldBlur("lastname")}
                autoComplete="family-name"
              />
              {touched.lastname && errors.lastname ? (
                <div className={styles.errorText}>{errors.lastname}</div>
              ) : null}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              className={styles.input}
              placeholder="Enter your email"
              value={email}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                onBlur={() => handleFieldBlur("email")}
                autoComplete="email"
              inputMode="email"
            />
            {touched.email && errors.email ? (
              <div className={styles.errorText}>{errors.email}</div>
            ) : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="mobile">
              Mobile
            </label>
            <input
              id="mobile"
              name="mobile"
              className={styles.input}
              placeholder="Enter your mobile number"
              value={mobile}
              onChange={(e) => {
                const next = onlyDigits(e.target.value).slice(0, 15);
                setMobile(next);
                if (touched.mobile) {
                  const error = validateField("mobile");
                  setErrors((p) => ({ ...p, mobile: error }));
                }
              }}
              onBlur={() => {
                setTouched((p) => ({ ...p, mobile: true }));
                const error = validateField("mobile");
                setErrors((p) => ({ ...p, mobile: error }));
              }}
              inputMode="tel"
              autoComplete="tel"
            />
            {touched.mobile && errors.mobile ? (
              <div className={styles.errorText}>{errors.mobile}</div>
            ) : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                name="password"
                className={styles.input}
                placeholder="Enter your password"
                value={password}
                type={showPw ? "text" : "password"}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) {
                    const error = validateField("password");
                    setErrors((p) => ({ ...p, password: error }));
                  }
                }}
                onBlur={() => handleFieldBlur("password")}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.togglePw}
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
            {touched.password && errors.password ? (
              <div className={styles.errorText}>{errors.password}</div>
            ) : null}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dob">
              DOB
            </label>
            <DatePicker
              id="dob"
              selected={dob ? new Date(dob) : null}
              onChange={(date: Date | null) => {
                const dateStr = date ? date.toISOString().split("T")[0] : "";
                setDob(dateStr);
                if (touched.dob) {
                  const error = validateField("dob");
                  setErrors((p) => ({ ...p, dob: error }));
                }
              }}
              onBlur={() => handleFieldBlur("dob")}
              placeholderText="Enter your dateofbirth"
              dateFormat="yyyy-MM-dd"
              className={styles.dateInput}
              wrapperClassName={styles.datePickerWrapper}
              maxDate={new Date()}
              showYearDropdown
              showMonthDropdown
              dropdownMode="select"
            />
            {touched.dob && errors.dob ? (
              <div className={styles.errorText}>{errors.dob}</div>
            ) : null}
          </div>

          <div className={styles.agreements}>
            <div className={styles.agreeTitle}>I agree to</div>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => {
                  setTerms(e.target.checked);
                  if (touched.terms) {
                    const error = validateField("terms");
                    setErrors((p) => ({ ...p, terms: error }));
                  }
                }}
                onBlur={() => handleFieldBlur("terms")}
              />
              Terms of Service
            </label>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={privacy}
                onChange={(e) => {
                  setPrivacy(e.target.checked);
                  if (touched.privacy) {
                    const error = validateField("privacy");
                    setErrors((p) => ({ ...p, privacy: error }));
                  }
                }}
                onBlur={() => handleFieldBlur("privacy")}
              />
              Privacy Policy
            </label>

         
          </div>
          {touched.terms && errors.terms ? (
              <div className={styles.errorText}>{errors.terms}</div>
            ) : null}
            {touched.privacy && errors.privacy ? (
              <div className={styles.errorText}>{errors.privacy}</div>
            ) : null}
          <Button
            variant="primary"
            type="submit"
            disabled={submitting}
            className={styles.submitButton}
          >
            {submitting ? (
              <span className={styles.buttonContent}>
                <span className={styles.spinner}></span>
                Creating...
              </span>
            ) : (
              "Create Account"
            )}
          </Button>

          </form>
          </div>
        </section>

        <aside className={styles.right} aria-hidden="true">
          <div className={styles.illustrationCard}>
            <Image
              src="/assets/side-image.svg"
              alt="Illustration"
              width={400}
              height={360}
              priority
              unoptimized
              className={styles.sideImage}
            />
          </div>
        </aside>
      </div>
      
      <div className={styles.chatIcon}>
        <Image
          src="/assets/chat.svg"
          alt="Chat Support"
          width={100}
          height={100}
          unoptimized
          className={styles.chatImage}
          loading="lazy"
        />
      </div>

      {successMsg && (
        <div className={styles.toast}>
          <div className={`${styles.toastContent} ${styles.toastSuccess}`}>
            <div className={styles.toastMessage}>{successMsg}</div>
            <button
              className={styles.toastClose}
              onClick={() => setSuccessMsg(null)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {formError && (
        <div className={styles.toast}>
          <div className={`${styles.toastContent} ${styles.toastError}`}>
            <div className={styles.toastMessage}>{formError}</div>
            <button
              className={styles.toastClose}
              onClick={() => setFormError(null)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

