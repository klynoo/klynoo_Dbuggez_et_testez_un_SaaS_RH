/* eslint-disable jest/no-mocks-import */
/**
 * @jest-environment jsdom
 */

import { screen, fireEvent, within } from "@testing-library/dom";
import "@testing-library/jest-dom";
import NewBillUI from "../views/NewBillUI.js";
import NewBill from "../containers/NewBill.js";
import userEvent from "@testing-library/user-event";
import { localStorageMock } from "../__mocks__/localStorage.js";
import mockStore from "../__mocks__/store.js";
import { ROUTES, ROUTES_PATH } from "../constants/routes.js";
import { bills } from "../fixtures/bills.js";
import router from "../app/Router.js";

jest.mock("../app/store", () => mockStore);

const initializeNewBill = () => {
  return new NewBill({
    document,
    onNavigate,
    store: mockStore,
    localStorage: window.localStorage,
  });
};

beforeAll(() => {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
  });

  window.localStorage.setItem(
    "user",
    JSON.stringify({
      type: "Employee",
      email: "a@a",
    })
  );
});

beforeEach(() => {
  const rootElement = document.createElement("div");
  rootElement.setAttribute("id", "root");
  document.body.append(rootElement);
  router();

  document.body.innerHTML = NewBillUI();

  window.onNavigate(ROUTES_PATH.NewBill);
});

afterEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = "";
});

describe("Given I am logged in as an employee", () => {
  describe("When I am on the NewBill Page", () => {
    test("The newBill icon in the vertical layout should be highlighted", () => {
      const mailIcon = screen.getByTestId("icon-mail");

      expect(mailIcon).toHaveClass("active-icon");
    });

    // --------------------------------------------------------- //
    // --------------------------------------------------------- //

    describe("When I fill the fields correctly and click the submit button", () => {
      test("The submission should process correctly and redirect to the Bills Page", async () => {
        const onNavigate = (pathname) => {
          document.body.innerHTML = ROUTES({ pathname });
        };

        const newBill = new NewBill({
          document,
          onNavigate,
          store: mockStore,
          localStorage: window.localStorage,
        });

        const inputData = bills[0];

        const newBillForm = screen.getByTestId("form-new-bill");

        const handleSubmit = jest.fn(newBill.handleSubmit);
        const imageInput = screen.getByTestId("file");

        const file = generateFile(inputData.fileName, ["image/jpg"]);

        const validateFile = jest.spyOn(newBill, "fileValidation");

        // Fill in the form fields
        selectExpenseType(inputData.type);
        userEvent.type(getExpenseName(), inputData.name);
        userEvent.type(getAmount(), inputData.amount.toString());
        userEvent.type(getDate(), inputData.date);
        userEvent.type(getVat(), inputData.vat.toString());
        userEvent.type(getPct(), inputData.pct.toString());
        userEvent.type(getCommentary(), inputData.commentary);
        await userEvent.upload(imageInput, file);

        // Validate the entered data
        expect(
          selectExpenseType(inputData.type).validity.valueMissing
        ).toBeFalsy();
        expect(getAmount().validity.valueMissing).toBeFalsy();
        expect(getPct().validity.valueMissing).toBeFalsy();
        expect(validateFile(file)).toBeTruthy();

        newBill.fileName = file.name;

        // Ensure the form is submittable
        const submitButton = screen.getByRole("button", { name: /envoyer/i });
        expect(submitButton.type).toBe("submit");

        // Submit the form
        newBillForm.addEventListener("submit", handleSubmit);
        userEvent.click(submitButton);

        expect(handleSubmit).toHaveBeenCalledTimes(1);

        // Verify redirection to Bills Page
        expect(screen.getByText(/Mes notes de frais/i)).toBeVisible();
      });

      test("A new bill should be created", async () => {
        const createBill = jest.fn(mockStore.bills().create);
        const updateBill = jest.fn(mockStore.bills().update);

        const { fileUrl, key } = await createBill();

        expect(createBill).toHaveBeenCalledTimes(1);

        expect(key).toBe("1234");
        expect(fileUrl).toBe("https://localhost:3456/images/test.jpg");

        const newBill = updateBill();

        expect(updateBill).toHaveBeenCalledTimes(1);

        await expect(newBill).resolves.toEqual({
          id: "47qAXb6fIm2zOKkLzMro",
          vat: "80",
          fileUrl:
            "https://firebasestorage.googleapis.com/v0/b/billable-677b6.a…f-1.jpg?alt=media&token=c1640e12-a24b-4b11-ae52-529112e9602a",
          status: "pending",
          type: "Hôtel et logement",
          commentary: "séminaire billed",
          name: "encore",
          fileName: "preview-facture-free-201801-pdf-1.jpg",
          date: "2004-04-04",
          amount: 400,
          commentAdmin: "ok",
          email: "a@a",
          pct: 20,
        });
      });
    });

    // --------------------------------------------------------- //
    // -------------- Default PCT Field Value -------------- //
    // --------------------------------------------------------- //

    describe("When the PCT input is left blank", () => {
      test("then the PCT should default to 20", () => {
        const newBill = initializeNewBill();

        const inputData = bills[0];

        const newBillForm = screen.getByTestId("form-new-bill");

        const handleSubmit = jest.spyOn(newBill, "handleSubmit");
        const updateBill = jest.spyOn(newBill, "updateBill");

        newBill.fileName = inputData.fileName;

        newBillForm.addEventListener("submit", handleSubmit);

        fireEvent.submit(newBillForm);

        expect(handleSubmit).toHaveBeenCalledTimes(1);

        expect(updateBill).toHaveBeenCalledWith(
          expect.objectContaining({
            pct: 20,
          })
        );
      });
    });

    // --------------------------------------------------------- //
    // ------------------ Unfilled Fields ------------------- //
    // --------------------------------------------------------- //

    describe("When I do not fill any fields and click the submit button", () => {
      test("Then it should stay on the newBill page", () => {
        const newBill = initializeNewBill();

        const newBillForm = screen.getByTestId("form-new-bill");

        const handleSubmit = jest.spyOn(newBill, "handleSubmit");

        newBillForm.addEventListener("submit", handleSubmit);
        fireEvent.submit(newBillForm);

        expect(handleSubmit).toHaveBeenCalledTimes(1);

        expect(newBillForm).toBeVisible();
      });
    });

    // --------------------------------------------------------- //
    // ----------- Incorrect File Format Uploaded ----------- //
    // --------------------------------------------------------- //

    describe("When I upload a file with an unsupported extension (not jpg, jpeg, or png)", () => {
      test("Then an error message should appear for the file input", () => {
        const newBill = initializeNewBill();

        const handleFileChange = jest.spyOn(newBill, "handleChangeFile");
        const imageInput = screen.getByTestId("file");
        const validateFile = jest.spyOn(newBill, "fileValidation");

        imageInput.addEventListener("change", handleFileChange);

        fireEvent.change(imageInput, {
          target: {
            files: [
              new File(["document"], "document.pdf", {
                type: "application/pdf",
              }),
            ],
          },
        });

        expect(handleFileChange).toHaveBeenCalledTimes(1);
        expect(validateFile.mock.results[0].value).toBeFalsy();

        expect(imageInput).toHaveClass("is-invalid");
      });
    });

    // --------------------------------------------------------- //
    // ------------- Correct File Format Uploaded ------------- //
    // --------------------------------------------------------- //

    describe("When I upload a file with a valid jpg, jpeg, or png extension", () => {
      test("Then no error message should appear for the file input", () => {
        const newBill = initializeNewBill();

        const handleFileChange = jest.spyOn(newBill, "handleChangeFile");
        const imageInput = screen.getByTestId("file");
        const validateFile = jest.spyOn(newBill, "fileValidation");

        imageInput.addEventListener("change", handleFileChange);

        fireEvent.change(imageInput, {
          target: {
            files: [
              new File(["image"], "image.jpg", {
                type: "image/jpg",
              }),
            ],
          },
        });

        expect(handleFileChange).toHaveBeenCalledTimes(1);
        expect(validateFile.mock.results[0].value).toBeTruthy();

        expect(imageInput).not.toHaveClass("is-invalid");
      });
    });

    describe("When an error occurs with the API", () => {
      test("Then the new bill is added to the API, but the fetch fails with a '404 page not found' error", async () => {
        const newBill = initializeNewBill();

        const mockedBill = jest
          .spyOn(mockStore, "bills")
          .mockImplementationOnce(() => {
            return {
              create: jest.fn().mockRejectedValue(new Error("Erreur 404")),
            };
          });

        await expect(mockedBill().create).rejects.toThrow("Erreur 404");

        expect(mockedBill).toHaveBeenCalledTimes(1);

        expect(newBill.billId).toBeNull();
        expect(newBill.fileUrl).toBeNull();
        expect(newBill.fileName).toBeNull();
      });

      test("Then the new bill is added to the API, but the fetch fails with a '500 Internal Server Error'", async () => {
        const newBill = initializeNewBill();

        const mockedBill = jest
          .spyOn(mockStore, "bills")
          .mockImplementationOnce(() => {
            return {
              create: jest.fn().mockRejectedValue(new Error("Erreur 500")),
            };
          });

        await expect(mockedBill().create).rejects.toThrow("Erreur 500");

        expect(mockedBill).toHaveBeenCalledTimes(1);

        expect(newBill.billId).toBeNull();
        expect(newBill.fileUrl).toBeNull();
        expect(newBill.fileName).toBeNull();
      });
    });
  });
});

// -------------------------------------------------------------- //
// ---------------------------- UTILS --------------------------- //
// -------------------------------------------------------------- //

const selectExpenseType = (expenseType) => {
  const dropdown = screen.getByRole("combobox");
  userEvent.selectOptions(
    dropdown,
    within(dropdown).getByRole("option", { name: expenseType })
  );
  return dropdown;
};

const getExpenseName = () => screen.getByTestId("expense-name");

const getAmount = () => screen.getByTestId("amount");

const getDate = () => screen.getByTestId("datepicker");

const getVat = () => screen.getByTestId("vat");

const getPct = () => screen.getByTestId("pct");

const getCommentary = () => screen.getByTestId("commentary");

const generateFile = (fileName, fileType) => {
  const file = new File(["img"], fileName, {
    type: [fileType],
  });

  return file;
};
