import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const VIETNAM_PHONE_PATTERN = /^(?:0\d{9}|\+84\d{9})$/;

export function normalizeVietnamPhoneNumber(
  phoneNumber?: string | null,
): string | null {
  const compactPhoneNumber = phoneNumber?.replace(/[\s.-]/g, '').trim();

  if (!compactPhoneNumber) {
    return null;
  }

  if (compactPhoneNumber.startsWith('+84')) {
    return `0${compactPhoneNumber.slice(3)}`;
  }

  return compactPhoneNumber;
}

export function IsVietnamPhoneNumber(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isVietnamPhoneNumber',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null || value === '') {
            return true;
          }

          if (typeof value !== 'string') {
            return false;
          }

          const compactPhoneNumber = value.replace(/[\s.-]/g, '').trim();
          return VIETNAM_PHONE_PATTERN.test(compactPhoneNumber);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Vietnam phone number`;
        },
      },
    });
  };
}
