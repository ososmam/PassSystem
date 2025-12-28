using GateManagment.Models;
using GateManagment.Services;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using Serilog;
using System.Dynamic;
using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;

namespace GateManagment.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PropertyController : ControllerBase
    {
        private readonly PropertyService _firestoreService;
        private readonly CardEntryService _userService;
        private readonly GateService _gateService;
        private readonly ISQLiteService _sqliteService;
        private readonly IStringLocalizer<PropertyController> _localizer;
        private readonly IConfiguration _configuration;

        public PropertyController(
            PropertyService firestoreService,
            CardEntryService userService,
            GateService gateService,
            ISQLiteService sqliteService,
            IStringLocalizer<PropertyController> localizer,
            IConfiguration configuration)
        {
            _firestoreService = firestoreService;
            _userService = userService;
            _gateService = gateService;
            _sqliteService = sqliteService;
            _localizer = localizer;
            _configuration = configuration;
        }

        // Update Property with Personal Card Photos
        [HttpPost("update")]
        public async Task<IActionResult> UpdateProperty([FromBody] UpdatePropertyRequest request)
        {
            if (!ModelState.IsValid || !request.Property.IsValid())
            {
                var errors = ModelState
                    .SelectMany(error => error.Value.Errors
                        .Select(errorMsg => new { Key = error.Key, Message = _localizer[errorMsg.ErrorMessage].Value }))
                    .ToDictionary(e => e.Key, e => e.Message);
                return BadRequest(new { message = errors });
            }

            try
            {
                // Use request-specific setting, fallback to configuration default
                bool useVerification = request.UseVerificationWorkflow ??
                    _configuration.GetValue<bool>("GateManagement:UseVerificationWorkflow", false);

                if (useVerification)
                {
                    return await UpdatePropertyWithVerification(request);
                }
                else
                {
                    return await UpdatePropertyDirect(request);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error in UpdateProperty");
                return StatusCode(500, new { message = _localizer["ServerError"].Value, details = ex.Message });
            }
        }

        // Update Property with Verification Workflow
        private async Task<IActionResult> UpdatePropertyWithVerification(UpdatePropertyRequest request)
        {
            // Note: For verification workflow, we allow updates to non-existent properties
            // The property will be created during the approval process if it doesn't exist

            // Validate car plate duplicates before creating pending update
            if (request.Property.CardsInfo != null && request.Property.CardsInfo.Any())
            {
                foreach (var cardInfo in request.Property.CardsInfo)
                {
                    // Check for duplicate car plate in SQLite
                    var existingHostId = await _sqliteService.GetHostIdByCarPlateAsync(cardInfo.CarPlate);
                    if (!string.IsNullOrEmpty(existingHostId))
                    {
                        return BadRequest(new { message = $"Car plate {cardInfo.CarPlate} already exists for property {existingHostId}" });
                    }
                }
            }

            // Create personal card photos list with empty card numbers for admin to fill
            var personalCardPhotos = request.PersonalCardPhotoUrls?.Select(url => new PersonalCardPhoto
            {
                PhotoUrl = url,
                CardNumber = null // Admin will fill this during verification
            }).ToList() ?? new List<PersonalCardPhoto>();

            // Check if there's already a pending update for this property
            var pendingId = $"{request.Property.Building}-{request.Property.Flat}-{request.Property.Type}";
            var existingPending = await _sqliteService.GetPendingUpdatePropertyAsync(pendingId);

            if (existingPending != null && existingPending.Status == PendingStatus.PendingReview)
            {
                return BadRequest(new { message = _localizer["PropertyUpdateAlreadyPending"].Value });
            }

            var pendingUpdate = new PendingUpdateProperty
            {
                PropertyData = request.Property,
                PersonalCardPhotos = personalCardPhotos,
                SubmittedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
                Status = PendingStatus.PendingReview,
                SubmittedBy = request.SubmittedBy,
                ReviewComments = new List<string>()
            };

            await _sqliteService.AddPendingUpdatePropertyAsync(pendingUpdate, pendingId);

            return Ok(new
            {
                message = _localizer["PropertyUpdateSubmittedForReview"].Value,
                pendingId = pendingId,
                status = "pending_review",
                personalCardPhotos = personalCardPhotos.Select(p => new { p.PhotoUrl, CardNumber = "" })
            });
        }

        // Direct Update Property (without verification)
        private async Task<IActionResult> UpdatePropertyDirect(UpdatePropertyRequest request)
        {
            // Validate car plate duplicates before processing
            if (request.Property.CardsInfo != null && request.Property.CardsInfo.Any())
            {
                foreach (var cardInfo in request.Property.CardsInfo)
                {
                    // Check for duplicate car plate in SQLite
                    var existingHostId = await _sqliteService.GetHostIdByCarPlateAsync(cardInfo.CarPlate);
                    if (!string.IsNullOrEmpty(existingHostId))
                    {
                        return BadRequest(new { message = $"Car plate {cardInfo.CarPlate} already exists for property {existingHostId}" });
                    }
                }
            }

            // Get existing property or create new one if not found
            var existingDoc = await _firestoreService.CheckIfDocumentExistsAsync("hosts", request.Property.Flat, request.Property.Building, request.Property.Type);

            Property property;
            string documentId;
            var hostId = $"{request.Property.Building}-{request.Property.Flat}{request.Property.Type.ToLower()[0]}";

            if (existingDoc == null || !existingDoc.Any())
            {
                // Create new property if not found
                property = new Property
                {
                    Name = request.Property.Name,
                    Phone = request.Property.Phone,
                    Building = request.Property.Building,
                    Flat = request.Property.Flat,
                    Type = request.Property.Type,
                    EndDate = request.Property.EndDate,
                    Verified = true,
                    PersonalCards = new List<string>(),
                    CardsInfo = new List<CardInfo>()
                };
                documentId = hostId;
            }
            else
            {
                var doc = existingDoc.First();
                property = doc.Value;
                documentId = doc.Key;

                // Update property data
                property.Name = request.Property.Name;
                property.Phone = request.Property.Phone;
                property.EndDate = request.Property.EndDate;
                property.Verified = true;
            }

            // Add car cards info to property and SQLite index
            if (request.Property.CardsInfo != null && request.Property.CardsInfo.Any())
            {
                foreach (var cardInfo in request.Property.CardsInfo)
                {
                    // Add to property CardsInfo if not already present
                    if (!property.CardsInfo.Any(c => c.CarPlate == cardInfo.CarPlate))
                    {
                        property.CardsInfo.Add(cardInfo);
                    }

                    // Add to SQLite CarPlateIndex
                    await _sqliteService.AddCarPlateIndexAsync(cardInfo.CarPlate, hostId, cardInfo.Card);
                }
            }

            // Note: Personal card numbers would need to be provided in the request for direct processing
            // For now, we'll just update the property without personal cards in direct mode

            // Create or update in Firestore
            if (existingDoc == null || !existingDoc.Any())
            {
                await _firestoreService.AddDocumentAsync("hosts", documentId, property);
            }
            else
            {
                await _firestoreService.UpdateDocumentAsync("hosts", documentId, property);
            }

            // Persist to SQLite: update property core fields and upsert cards
            await _sqliteService.UpdatePropertyAsync(property, documentId);
            await _sqliteService.UpsertPropertyCarCardsAsync(documentId, property.CardsInfo ?? new List<CardInfo>());
            await _sqliteService.UpsertPropertyPersonalCardsAsync(documentId, property.PersonalCards ?? new List<string>());

            return Ok(new { message = _localizer["PropertyUpdated"].Value });
        }

        // Verify Update Property
        [HttpPost("verify-update/{pendingId}")]
        public async Task<IActionResult> VerifyUpdateProperty(string pendingId, [FromBody] VerifyUpdatePropertyRequest request)
        {
            try
            {
                var pendingUpdate = await _sqliteService.GetPendingUpdatePropertyAsync(pendingId);

                if (pendingUpdate == null)
                {
                    return NotFound(new { message = _localizer["PendingUpdateNotFound"].Value });
                }

                if (request.Action == VerificationAction.Approve)
                {
                    // Update personal card photos with admin-entered card numbers
                    foreach (var cardVerification in request.PersonalCardVerifications)
                    {
                        var photo = pendingUpdate.PersonalCardPhotos.FirstOrDefault(p => p.PhotoUrl == cardVerification.PhotoUrl);
                        if (photo != null)
                        {
                            photo.CardNumber = cardVerification.CardNumber;
                        }
                    }

                    // Process the approved update
                    var result = await ProcessApprovedPropertyUpdate(pendingUpdate, pendingId);

                    if (result.Success)
                    {
                        // Update pending status
                        pendingUpdate.Status = PendingStatus.Approved;
                        pendingUpdate.ReviewedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                        pendingUpdate.ReviewedBy = request.Reviewer;
                        pendingUpdate.ReviewComments.Add(request.Comments ?? "Approved");

                        await _sqliteService.UpdatePendingUpdatePropertyAsync(pendingUpdate, pendingId);

                        return Ok(new { message = _localizer["PropertyUpdateApproved"].Value });
                    }
                    else
                    {
                        return BadRequest(new { message = result.ErrorMessage });
                    }
                }
                else if (request.Action == VerificationAction.Reject)
                {
                    // Reject the update
                    pendingUpdate.Status = PendingStatus.Rejected;
                    pendingUpdate.ReviewedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                    pendingUpdate.ReviewedBy = request.Reviewer;
                    pendingUpdate.ReviewComments.Add(request.Comments ?? "Rejected");

                    await _sqliteService.UpdatePendingUpdatePropertyAsync(pendingUpdate, pendingId);

                    return Ok(new { message = _localizer["PropertyUpdateRejected"].Value });
                }

                return BadRequest(new { message = _localizer["InvalidAction"].Value });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error verifying property update");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        // Process approved property update
        private async Task<ProcessResult> ProcessApprovedPropertyUpdate(PendingUpdateProperty pendingUpdate, string pendingId)
        {
            try
            {
                var data = pendingUpdate.PropertyData;
                var hostId = $"{data.Building}-{data.Flat}{data.Type.ToLower()[0]}";

                // Get existing property or create new one if not found
                var existingDoc = await _firestoreService.CheckIfDocumentExistsAsync("hosts", data.Flat, data.Building, data.Type);

                Property property;
                string documentId;

                if (existingDoc == null || !existingDoc.Any())
                {
                    // Create new property if not found
                    property = new Property
                    {
                        Name = data.Name,
                        Phone = data.Phone,
                        Building = data.Building,
                        Flat = data.Flat,
                        Type = data.Type,
                        EndDate = data.EndDate,
                        Verified = true,
                        PersonalCards = new List<string>(),
                        CardsInfo = new List<CardInfo>()
                    };
                    documentId = hostId;
                }
                else
                {
                    var doc = existingDoc.First();
                    property = doc.Value;
                    documentId = doc.Key;
                }

                // Update property data
                property.Name = data.Name;
                property.Phone = data.Phone;
                property.EndDate = data.EndDate;
                property.Verified = true;

                // Add personal card numbers from verified photos
                var personalCardNumbers = pendingUpdate.PersonalCardPhotos
                    .Where(p => !string.IsNullOrEmpty(p.CardNumber))
                    .Select(p => p.CardNumber)
                    .ToList();

                if (personalCardNumbers.Any())
                {
                    if (property.PersonalCards == null)
                        property.PersonalCards = new List<string>();

                    // Add new personal cards (avoid duplicates)
                    foreach (var cardNumber in personalCardNumbers)
                    {
                        if (!property.PersonalCards.Contains(cardNumber))
                        {
                            property.PersonalCards.Add(cardNumber);
                        }
                    }
                }

                // Handle CardsInfo (car plates) from property data
                if (data.CardsInfo != null && data.CardsInfo.Any())
                {
                    if (property.CardsInfo == null)
                        property.CardsInfo = new List<CardInfo>();

                    // Add new car cards (avoid duplicates)
                    foreach (var cardInfo in data.CardsInfo)
                    {
                        if (!property.CardsInfo.Any(c => c.Card == cardInfo.Card))
                        {
                            property.CardsInfo.Add(cardInfo);
                        }
                    }
                }

                // Update in Firestore (create or update)
                if (existingDoc == null || !existingDoc.Any())
                {
                    // Create new document
                    await _firestoreService.AddDocumentAsync("hosts", documentId, property);
                }
                else
                {
                    // Update existing document
                    await _firestoreService.UpdateDocumentAsync("hosts", documentId, property);
                }

                // Add personal cards to gate system
                List<GateRequestResult> gateResults = new List<GateRequestResult>();
                if (personalCardNumbers.Any())
                {
                    foreach (var cardNumber in personalCardNumbers)
                    {
                        try
                        {
                            // Add to gates one by one
                            var newUser = new CardEntry { CardNo = cardNumber, Pin = cardNumber };
                            var cardGateResults = await _userService.AddCardToAllGates(newUser, ActiveType.CarsAndCards);
                            gateResults.AddRange(cardGateResults);

                            // Small delay to avoid overwhelming the gates
                            await Task.Delay(200);
                        }
                        catch (Exception ex)
                        {
                            Log.Warning(ex, "Failed to add personal card {CardNumber} to gates for {HostId}", cardNumber, hostId);
                            gateResults.Add(new GateRequestResult { Success = false, ErrorMessage = ex.Message });
                        }
                    }
                }

                // Add car cards to gate system
                if (data.CardsInfo != null && data.CardsInfo.Any())
                {
                    foreach (var cardInfo in data.CardsInfo)
                    {
                        try
                        {
                            // Add to gates one by one
                            var newUser = new CardEntry { CardNo = cardInfo.Card, Pin = cardInfo.Card };
                            var cardGateResults = await _userService.AddCardToAllGates(newUser, ActiveType.CarsOnly);
                            gateResults.AddRange(cardGateResults);

                            await UpdateGateStatuses(cardInfo, cardGateResults);

                            // Add to SQLite CarPlateIndex for duplicate checking
                            await _sqliteService.AddCarPlateIndexAsync(cardInfo.CarPlate, hostId, cardInfo.Card);

                            // Small delay to avoid overwhelming the gates
                            await Task.Delay(200);
                        }
                        catch (Exception ex)
                        {
                            Log.Warning(ex, "Failed to add car card {CardNumber} to gates for {HostId}", cardInfo.Card, hostId);
                            gateResults.Add(new GateRequestResult { Success = false, ErrorMessage = ex.Message });
                        }
                    }
                }

                // Clean up - delete pending update
                await _sqliteService.DeletePendingUpdatePropertyAsync(pendingId);

                // Persist to SQLite: update property core fields and upsert cards
                await _sqliteService.UpdatePropertyAsync(property, hostId);
                await _sqliteService.UpsertPropertyCarCardsAsync(hostId, property.CardsInfo ?? new List<CardInfo>());
                await _sqliteService.UpsertPropertyPersonalCardsAsync(hostId, property.PersonalCards ?? new List<string>());

                return new ProcessResult
                {
                    Success = true,
                    GateResults = gateResults,
                    Message = _localizer["PropertyUpdateProcessed"].Value
                };
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error processing approved property update");
                return new ProcessResult { Success = false, ErrorMessage = ex.Message };
            }
        }

        // Add Document: Checks if the document exists and adds it if not.
        [HttpPost("add")]
        public async Task<IActionResult> AddProperty([FromBody] PropertyAddRequest request)
        {
            if (!ModelState.IsValid || !request.Property.IsValid())
            {
                var errors = ModelState
                    .SelectMany(error => error.Value.Errors
                        .Select(errorMsg => new { Key = error.Key, Message = _localizer[errorMsg.ErrorMessage].Value }))
                    .ToDictionary(e => e.Key, e => e.Message);
                return BadRequest(new { message = errors });
            }

            try
            {
                // Use request-specific setting, fallback to configuration default
                bool useVerification = request.UseVerificationWorkflow ??
                    _configuration.GetValue<bool>("GateManagement:UseVerificationWorkflow", false);

                // Route to appropriate workflow based on request
                if (useVerification)
                {
                    return await AddPropertyWithVerification(request.Property, request.SubmittedBy);
                }
                else
                {
                    return await AddPropertyDirect(request.Property);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error in AddProperty");
                return StatusCode(500, new { message = _localizer["ServerError"].Value, details = ex.Message });
            }
        }

        // Verification workflow
        private async Task<IActionResult> AddPropertyWithVerification(Property data, string submittedBy)
        {
            // NEW: Validate for duplicate car plates within the same submission
            if (data.CardsInfo != null && data.CardsInfo.Count > 1)
            {
                var carPlates = data.CardsInfo.Select(c => CardInfo.SanitizeCarPlate(c.CarPlate)).ToList();
                var duplicatePlates = carPlates.GroupBy(x => x)
                    .Where(g => g.Count() > 1)
                    .Select(g => g.Key);

                if (duplicatePlates.Any())
                {
                    return BadRequest(new
                    {
                        message = _localizer["DuplicateCarPlatesInSubmission"].Value + ": " + string.Join(", ", duplicatePlates)
                    });
                }

                var cardNumbers = data.CardsInfo.Select(c => c.Card).ToList();
                var duplicateCards = cardNumbers.GroupBy(x => x)
                    .Where(g => g.Count() > 1)
                    .Select(g => g.Key);

                if (duplicateCards.Any())
                {
                    return BadRequest(new
                    {
                        message = _localizer["DuplicateCardNumbersInSubmission"].Value + ": " + string.Join(", ", duplicateCards)
                    });
                }
            }

            // NEW: Validate for duplicate personal cards within the same submission
            if (data.PersonalCards != null && data.PersonalCards.Count > 1)
            {
                var duplicatePersonalCards = data.PersonalCards.GroupBy(x => x)
                    .Where(g => g.Count() > 1)
                    .Select(g => g.Key);

                if (duplicatePersonalCards.Any())
                {
                    return BadRequest(new
                    {
                        message = _localizer["DuplicatePersonalCardsInSubmission"].Value + ": " + string.Join(", ", duplicatePersonalCards)
                    });
                }
            }

            // Validation logic for verification workflow
            if (data.CardsInfo != null)
            {
                foreach (var cardInfo in data.CardsInfo)
                {
                    cardInfo.CarPlate = CardInfo.SanitizeCarPlate(cardInfo.CarPlate);

                    // Check existing car plate in both hosts and pending (Firestore)
                    if (await _firestoreService.GetDocumentAsync("carPlatesIndex", cardInfo.CarPlate) is var carPlateDoc && carPlateDoc != null)
                    {
                        return BadRequest(new { message = _localizer["CarPlateAlreadyExists", cardInfo.CarPlate].Value + $" in {carPlateDoc["docId"]?.ToString() ?? "unknown"}" });
                    }

                    // Check existing card (Firestore)
                    var existingCards = await _firestoreService.QueryCollectionAsync(
                        "carPlatesIndex",
                        new[] { ("cardNumber", "==", (object)cardInfo.Card) }
                    );

                    if (existingCards.Any())
                    {
                        var existingCard = existingCards.First();
                        return BadRequest(new { message = _localizer["CardAlreadyExists", cardInfo.Card].Value + $" in {existingCard["docId"]?.ToString() ?? "unknown"}" });
                    }

                    // Check in other pending properties (SQLite - exclude current if updating)
                    var allPending = await _sqliteService.GetAllPendingPropertiesAsync();
                    var conflictingPending = allPending.FirstOrDefault(p =>
                        p.PropertyData.Phone != data.Phone && // Different property
                        p.PropertyData.CardsInfo?.Any(c => c.Card == cardInfo.Card || c.CarPlate == cardInfo.CarPlate) == true &&
                        p.Status == PendingStatus.PendingReview);

                    if (conflictingPending != null)
                    {
                        return BadRequest(new { message = _localizer["CardAlreadyPendingInOther", cardInfo.Card].Value });
                    }
                }
            }

            if (data.PersonalCards != null)
            {
                foreach (var card in data.PersonalCards)
                {
                    // Check in hosts (Firestore)
                    var existingHosts = await _firestoreService.QueryCollectionAsync(
                        "hosts",
                        new[] { ("PersonalCards", "array-contains", (object)card) }
                    );

                    if (existingHosts.Any())
                    {
                        var existingHost = existingHosts.First();
                        return BadRequest(new { message = _localizer["CardAlreadyExists", card].Value + $" in {existingHost["flat"]?.ToString() ?? "unknown"}-{existingHost["building"]?.ToString() ?? "unknown"}" });
                    }

                    // Check in other pending properties (SQLite - exclude current if updating)
                    var allPending = await _sqliteService.GetAllPendingPropertiesAsync();
                    var conflictingPending = allPending.FirstOrDefault(p =>
                        p.PropertyData.Phone != data.Phone && // Different property
                        p.PropertyData.PersonalCards?.Contains(card) == true &&
                        p.Status == PendingStatus.PendingReview);

                    if (conflictingPending != null)
                    {
                        return BadRequest(new { message = _localizer["CardAlreadyPendingInOther", card].Value });
                    }
                }
            }

            // FIXED: Check if there's already a pending property for this phone
            var existingPending = await _sqliteService.GetPendingPropertyAsync(data.Phone);

            if (existingPending != null && existingPending.Status == PendingStatus.PendingReview)
            {
                // Merge with existing pending property
                return await MergePendingProperty(existingPending, data, submittedBy);
            }

            var pendingProperty = new PendingProperty
            {
                PropertyData = data,
                SubmittedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
                Status = PendingStatus.PendingReview,
                SubmittedBy = submittedBy,
                ReviewComments = new List<string>(),
                CarPlates = data.CardsInfo?.Select(c => c.CarPlate).ToList() ?? new List<string>()
            };

            await _sqliteService.AddPendingPropertyAsync(pendingProperty, data.Phone);

            return Ok(new
            {
                message = _localizer["PropertySubmittedForReview"].Value,
                pendingId = data.Phone,
                status = "pending_review"
            });
        }

        private async Task<IActionResult> MergePendingProperty(PendingProperty existingPending, Property newData, string submittedBy)
        {
            try
            {
                var hasChanges = false;

                // Merge card information
                if (newData.CardsInfo != null && newData.CardsInfo.Any())
                {
                    if (existingPending.PropertyData.CardsInfo == null)
                        existingPending.PropertyData.CardsInfo = new List<CardInfo>();

                    foreach (var newCardInfo in newData.CardsInfo)
                    {
                        // Check if card already exists in pending
                        if (!existingPending.PropertyData.CardsInfo.Any(c => c.Card == newCardInfo.Card))
                        {
                            existingPending.PropertyData.CardsInfo.Add(newCardInfo);
                            if (!existingPending.CarPlates.Contains(newCardInfo.CarPlate))
                            {
                                existingPending.CarPlates.Add(newCardInfo.CarPlate);
                            }
                            hasChanges = true;
                        }
                    }
                }

                if (newData.PersonalCards != null && newData.PersonalCards.Any())
                {
                    if (existingPending.PropertyData.PersonalCards == null)
                        existingPending.PropertyData.PersonalCards = new List<string>();

                    foreach (var newCard in newData.PersonalCards)
                    {
                        if (!existingPending.PropertyData.PersonalCards.Contains(newCard))
                        {
                            existingPending.PropertyData.PersonalCards.Add(newCard);
                            hasChanges = true;
                        }
                    }
                }

                if (!hasChanges)
                {
                    return BadRequest(new { message = _localizer["NoNewCardsToAdd"].Value });
                }

                // Update other property data if needed
                existingPending.PropertyData.Name = newData.Name ?? existingPending.PropertyData.Name;
                existingPending.PropertyData.EndDate = newData.EndDate ?? existingPending.PropertyData.EndDate;

                // Add comment about the merge
                existingPending.ReviewComments.Add($"Additional cards added by {submittedBy} at {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}");

                await _sqliteService.UpdatePendingPropertyAsync(existingPending, existingPending.PropertyData.Phone);

                return Ok(new
                {
                    message = _localizer["CardsAddedToPendingProperty"].Value,
                    pendingId = existingPending.PropertyData.Phone,
                    status = "pending_review",
                    addedCards = newData.CardsInfo?.Count ?? 0,
                    addedPersonalCards = newData.PersonalCards?.Count ?? 0
                });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error merging pending property");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        // Direct processing (original logic)
        private async Task<IActionResult> AddPropertyDirect(Property data)
        {
            // Original validation logic (only check hosts, not pending)
            if (data.CardsInfo != null)
            {
                foreach (var cardInfo in data.CardsInfo)
                {
                    cardInfo.CarPlate = CardInfo.SanitizeCarPlate(cardInfo.CarPlate);

                    // Check existing car plate
                    if (await _firestoreService.GetDocumentAsync("carPlatesIndex", cardInfo.CarPlate) is var carPlateDoc && carPlateDoc != null)
                    {
                        return BadRequest(new { message = _localizer["CarPlateAlreadyExists", cardInfo.CarPlate].Value + $" in {carPlateDoc["docId"]?.ToString() ?? "unknown"}" });
                    }

                    // Check existing card
                    var existingCards = await _firestoreService.QueryCollectionAsync(
                        "carPlatesIndex",
                        new[] { ("cardNumber", "==", (object)cardInfo.Card) }
                    );

                    if (existingCards.Any())
                    {
                        var existingCard = existingCards.First();
                        return BadRequest(new { message = _localizer["CardAlreadyExists", cardInfo.Card].Value + $" in {existingCard["docId"]?.ToString() ?? "unknown"}" });
                    }
                }
            }

            if (data.PersonalCards != null)
            {
                foreach (var card in data.PersonalCards)
                {
                    // Query hosts where personalCards array contains this card
                    var existingHosts = await _firestoreService.QueryCollectionAsync(
                        "hosts",
                        new[] { ("PersonalCards", "array-contains", (object)card) }
                    );

                    if (existingHosts.Any())
                    {
                        var existingHost = existingHosts.First();
                        return BadRequest(new { message = _localizer["CardAlreadyExists", card].Value + $" in {existingHost["flat"]?.ToString() ?? "unknown"}-{existingHost["building"]?.ToString() ?? "unknown"}" });
                    }
                }
            }

            var hostId = $"{data.Building}-{data.Flat}{data.Type.ToLower()[0]}";
            var existingDoc = await _firestoreService.CheckIfDocumentExistsAsync("hosts", data.Flat, data.Building, data.Type);
            List<GateRequestResult> addUserResult = null;

            if (existingDoc != null)
            {
                // Update existing document
                var doc = existingDoc.First();
                var property = doc.Value;

                // Update basic info
                property.EndDate = data.EndDate;
                property.Name = data.Name;
                property.Phone = data.Phone;

                if (data.CardsInfo != null)
                {
                    // Add new cards
                    foreach (var cardInfo in data.CardsInfo)
                    {
                        property.CardsInfo.Add(cardInfo);
                        var newUser = new CardEntry { CardNo = cardInfo.Card, Pin = cardInfo.Card };
                        addUserResult = await _userService.AddCardToAllGates(newUser, ActiveType.CarsOnly);

                        await UpdateGateStatuses(cardInfo, addUserResult);
                        await _sqliteService.AddCarPlateIndexAsync(cardInfo.CarPlate, hostId, cardInfo.Card);
                    }
                }
                if (data.PersonalCards != null)
                {
                    foreach (var card in data.PersonalCards)
                    {
                        property.PersonalCards.Add(card);
                        var newUser = new CardEntry { CardNo = card, Pin = card };
                        addUserResult = await _userService.AddCardToAllGates(newUser, ActiveType.CarsAndCards);
                    }
                }
                await _firestoreService.UpdateDocumentAsync("hosts", doc.Key, property);

                // Update SQLite database
                await _sqliteService.UpdatePropertyAsync(property, hostId);
                // Upsert card tables to reflect latest cards
                await _sqliteService.UpsertPropertyCarCardsAsync(hostId, property.CardsInfo);
                await _sqliteService.UpsertPropertyPersonalCardsAsync(hostId, property.PersonalCards);
            }
            else
            {
                // Create new document
                data.Verified = false; // Keep original logic

                if (data.CardsInfo != null && data.CardsInfo.Any())
                {
                    var firstCard = data.CardsInfo[0];
                    var newUser = new CardEntry { CardNo = firstCard.Card, Pin = firstCard.Card };
                    addUserResult = await _userService.AddCardToAllGates(newUser, ActiveType.CarsOnly);

                    await UpdateGateStatuses(firstCard, addUserResult);
                }
                else if (data.PersonalCards != null && data.PersonalCards.Any())
                {
                    var card = data.PersonalCards[0];
                    var newUser = new CardEntry { CardNo = card, Pin = card };
                    addUserResult = await _userService.AddCardToAllGates(newUser, ActiveType.CarsAndCards);
                }

                await _firestoreService.AddPropertyAsync("hosts", data);

                // Add to SQLite database
                await _sqliteService.AddPropertyAsync(data, hostId);
                // Upsert card tables for newly created property
                await _sqliteService.UpsertPropertyCarCardsAsync(hostId, data.CardsInfo);
                await _sqliteService.UpsertPropertyPersonalCardsAsync(hostId, data.PersonalCards);
            }

            if (data.CardsInfo != null && data.CardsInfo.Any())
            {
                // Add entries to carPlatesIndex
                var indexTasks = data.CardsInfo.Select(cardInfo =>
                    _firestoreService.AddDocumentAsync("carPlatesIndex", cardInfo.CarPlate, new
                    {
                        docId = hostId,
                        cardNumber = cardInfo.Card
                    })
                );
                await Task.WhenAll(indexTasks);
            }

            return Ok(addUserResult);
        }

        [HttpGet("pending")]
        public async Task<IActionResult> GetPendingProperties([FromQuery] PendingStatus? status = null)
        {
            try
            {
                var targetStatus = status ?? PendingStatus.PendingReview;
                var pendingProperties = await _sqliteService.GetPendingPropertiesByStatusAsync(targetStatus);
                return Ok(pendingProperties);


            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error getting pending properties");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        [HttpGet("pending-updates")]
        public async Task<IActionResult> GetPendingUpdates([FromQuery] PendingStatus? status = null)
        {
            try
            {
                // Default to PendingReview if no status is provided
                var targetStatus = status ?? PendingStatus.PendingReview;
                
                var pendingUpdates = await _sqliteService.GetPendingUpdatePropertiesByStatusAsync(targetStatus);
                return Ok(pendingUpdates);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error getting pending updates");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        [HttpDelete("pending-updates/{pendingId}")]
        public async Task<IActionResult> DeletePendingUpdate(string pendingId)
        {
            try
            {
                // Delete from SQLite
                await _sqliteService.DeletePendingUpdatePropertyAsync(pendingId);

                return Ok(new { message = _localizer["PendingUpdateDeleted"].Value });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error deleting pending update {PendingId}", pendingId);
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        [HttpPut("pending-updates/{pendingId}")]
        public async Task<IActionResult> UpdatePendingUpdate(string pendingId, [FromBody] UpdatePendingUpdateRequest request)
        {
            try
            {
                var pendingUpdate = await _sqliteService.GetPendingUpdatePropertyAsync(pendingId);

                if (pendingUpdate == null)
                {
                    return NotFound(new { message = _localizer["PendingUpdateNotFound"].Value });
                }

                if (pendingUpdate.Status == PendingStatus.Approved)
                {
                    return BadRequest(new { message = _localizer["CannotEditProcessedUpdate"].Value });
                }

                // Validate new data before updating
                if (!request.Property.IsValid())
                {
                    var errors = ModelState
                        .SelectMany(error => error.Value.Errors
                            .Select(errorMsg => new { Key = error.Key, Message = _localizer[errorMsg.ErrorMessage].Value }))
                        .ToDictionary(e => e.Key, e => e.Message);
                    return BadRequest(new { message = errors });
                }

                // Check for conflicts with new data (car plates)
                if (request.Property.CardsInfo != null)
                {
                    foreach (var cardInfo in request.Property.CardsInfo)
                    {
                        if (cardInfo == null || cardInfo.CarPlate == null) continue;
                        
                        cardInfo.CarPlate = CardInfo.SanitizeCarPlate(cardInfo.CarPlate);

                        // Check if car plate exists in SQLite CarPlateIndex
                        var existingHostId = await _sqliteService.GetHostIdByCarPlateAsync(cardInfo.CarPlate);
                        if (existingHostId != null)
                        {
                            var currentHostId = $"{request.Property.Building}-{request.Property.Flat}-{request.Property.Type}";
                            if (existingHostId != currentHostId)
                            {
                                return BadRequest(new { message = _localizer["CarPlateAlreadyExists", cardInfo.CarPlate].Value + $" in {existingHostId}" });
                            }
                        }
                    }
                }

                // Check for conflicts with personal cards
                if (request.Property.PersonalCards != null)
                {
                    foreach (var card in request.Property.PersonalCards)
                    {
                        if (string.IsNullOrEmpty(card)) continue;

                        // Check existing personal card in hosts
                        if (await _firestoreService.GetDocumentAsync("personalCardsIndex", card) is var personalCardDoc && personalCardDoc != null)
                        {
                            return BadRequest(new { message = _localizer["PersonalCardAlreadyExists", card].Value + $" in {personalCardDoc["docId"]?.ToString() ?? "unknown"}" });
                        }

                        // Check if card is pending in another property update
                        var conflictingPending = (await _sqliteService.GetPendingUpdatePropertiesByStatusAsync(PendingStatus.PendingReview))
                            .FirstOrDefault(p => p.PropertyData.PersonalCards?.Contains(card) == true);

                        if (conflictingPending != null)
                        {
                            var conflictingId = $"{conflictingPending.PropertyData.Building}-{conflictingPending.PropertyData.Flat}-{conflictingPending.PropertyData.Type}";
                            if (conflictingId != pendingId)
                            {
                                return BadRequest(new { message = _localizer["CardAlreadyPendingInOther", card].Value });
                            }
                        }
                    }
                }

                // Update the pending update
                pendingUpdate.PropertyData = request.Property;
                if (request.PersonalCardPhotos != null)
                {
                    pendingUpdate.PersonalCardPhotos = request.PersonalCardPhotos;
                }

                await _sqliteService.UpdatePendingUpdatePropertyAsync(pendingUpdate, pendingId);

                return Ok(new { message = _localizer["PendingUpdateUpdated"].Value });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error updating pending update {PendingId}", pendingId);
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        [HttpPost("verify/{pendingId}")]
        public async Task<IActionResult> VerifyProperty(string pendingId, [FromBody] VerificationRequest request)
        {
            Log.Information("VerifyProperty called with pendingId: {PendingId}", pendingId);

            if (request == null)
            {
                Log.Warning("VerificationRequest is null for pendingId {PendingId}", pendingId);
                return BadRequest(new { message = "Request body is required" });
            }

            Log.Information("Request received - Action: {Action}, Reviewer: {Reviewer}, Comments: {Comments}",
                request.Action, request.Reviewer, request.Comments);

            // Add model validation check
            if (!ModelState.IsValid)
            {
                var errors = ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage)).ToList();
                Log.Warning("Invalid VerificationRequest for pendingId {PendingId}. ModelState errors: {@Errors}",
                    pendingId, errors);
                return BadRequest(new { message = "Validation failed", errors = errors });
            }

            Log.Debug("VerifyProperty called with pendingId: {PendingId}, Action: {Action}, Reviewer: {Reviewer}",
                pendingId, request.Action, request.Reviewer);

            try
            {
                // Get from SQLite first
                var pendingProperty = await _sqliteService.GetPendingPropertyAsync(pendingId);

                // If not found in SQLite, try Firestore
                if (pendingProperty == null)
                {

                    return NotFound(new { message = _localizer["PendingPropertyNotFound"].Value });


                }

                if (request.Action == VerificationAction.Approve)
                {
                    // Process the approval
                    var result = await ProcessApprovedProperty(pendingProperty.PropertyData, pendingId);

                    if (result.Success)
                    {

                        pendingProperty.Status = PendingStatus.Approved;
                        pendingProperty.ReviewedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                        pendingProperty.ReviewedBy = request.Reviewer;
                        pendingProperty.ReviewComments.Add(request.Comments ?? "Approved");

                        await _sqliteService.UpdatePendingPropertyAsync(pendingProperty, pendingId);

                        return Ok(new
                        {
                            message = _localizer["PropertyApproved"].Value,
                            gateResults = result.GateResults
                        });
                    }
                    else
                    {
                        return BadRequest(new { message = result.ErrorMessage });
                    }
                }
                else if (request.Action == VerificationAction.Reject)
                {
                    // Reject the property
                    pendingProperty.Status = PendingStatus.Rejected;
                    pendingProperty.ReviewedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                    pendingProperty.ReviewedBy = request.Reviewer;
                    pendingProperty.ReviewComments.Add(request.Comments ?? "Rejected");

                    // Update both SQLite and Firestore
                    await _sqliteService.UpdatePendingPropertyAsync(pendingProperty, pendingId);
                    //await _firestoreService.UpdateDocumentAsync("pendingProperties", pendingId, pendingProperty);

                    return Ok(new { message = _localizer["PropertyRejected"].Value });
                }

                return BadRequest(new { message = _localizer["InvalidAction"].Value });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error verifying property");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        // Process approved property (original logic with SQLite integration)
        private async Task<ProcessResult> ProcessApprovedProperty(Property data, string pendingId)
        {
            try
            {
                var hostId = $"{data.Building}-{data.Flat}{data.Type.ToLower()[0]}";
                var existingDoc = await _firestoreService.CheckIfDocumentExistsAsync("hosts", data.Flat, data.Building, data.Type);
                List<GateRequestResult> allGateResults = new List<GateRequestResult>();

                if (existingDoc != null)
                {
                    // Update existing document
                    var doc = existingDoc.First();
                    var property = doc.Value;

                    property.EndDate = data.EndDate;
                    property.Name = data.Name;
                    property.Phone = data.Phone;
                    property.Verified = true;

                    // FIXED: Process cards one by one to avoid conflicts
                    if (data.CardsInfo != null)
                    {
                        foreach (var cardInfo in data.CardsInfo)
                        {
                            // Check if card already exists in the property
                            if (!property.CardsInfo.Any(c => c.Card == cardInfo.Card))
                            {
                                property.CardsInfo.Add(cardInfo);

                                try
                                {
                                    // Add to gates one by one
                                    var newUser = new CardEntry { CardNo = cardInfo.Card, Pin = cardInfo.Card };
                                    var cardGateResults = await _userService.AddCardToAllGates(newUser, ActiveType.CarsOnly);
                                    allGateResults.AddRange(cardGateResults);

                                    await UpdateGateStatuses(cardInfo, cardGateResults);

                                    await _sqliteService.AddCarPlateIndexAsync(cardInfo.CarPlate, hostId, cardInfo.Card);
                                    // Small delay to avoid overwhelming the gates
                                    await Task.Delay(200);
                                }
                                catch (Exception ex)
                                {
                                    Log.Warning(ex, "Failed to add card {Card} to gates", cardInfo.Card);
                                    // Continue with other cards even if one fails
                                }
                            }
                        }
                    }

                    if (data.PersonalCards != null)
                    {
                        foreach (var card in data.PersonalCards)
                        {
                            if (!property.PersonalCards.Contains(card))
                            {
                                property.PersonalCards.Add(card);

                                try
                                {
                                    // Add to gates one by one
                                    var newUser = new CardEntry { CardNo = card, Pin = card };
                                    var cardGateResults = await _userService.AddCardToAllGates(newUser, ActiveType.CarsAndCards);
                                    allGateResults.AddRange(cardGateResults);

                                    // Small delay to avoid overwhelming the gates
                                    await Task.Delay(200);
                                }
                                catch (Exception ex)
                                {
                                    Log.Warning(ex, "Failed to add personal card {Card} to gates", card);
                                    // Continue with other cards even if one fails
                                }
                            }
                        }
                    }

                    await _firestoreService.UpdateDocumentAsync("hosts", doc.Key, property);
                    await _sqliteService.UpdatePropertyAsync(property, hostId);
                }
                else
                {
                    // Create new document
                    data.Verified = true;

                    // FIXED: Process cards one by one for new properties too
                    if (data.CardsInfo != null && data.CardsInfo.Any())
                    {
                        foreach (var cardInfo in data.CardsInfo)
                        {
                            try
                            {
                                var newUser = new CardEntry { CardNo = cardInfo.Card, Pin = cardInfo.Card };
                                var cardGateResults = await _userService.AddCardToAllGates(newUser, ActiveType.CarsOnly);
                                allGateResults.AddRange(cardGateResults);

                                await UpdateGateStatuses(cardInfo, cardGateResults);

                                await _sqliteService.AddCarPlateIndexAsync(cardInfo.CarPlate, hostId, cardInfo.Card);
                                // Small delay between cards
                                await Task.Delay(200);
                            }
                            catch (Exception ex)
                            {
                                Log.Warning(ex, "Failed to add card {Card} to gates", cardInfo.Card);
                            }
                        }
                    }
                    else if (data.PersonalCards != null && data.PersonalCards.Any())
                    {
                        foreach (var card in data.PersonalCards)
                        {
                            try
                            {
                                var newUser = new CardEntry { CardNo = card, Pin = card };
                                var cardGateResults = await _userService.AddCardToAllGates(newUser, ActiveType.CarsAndCards);
                                allGateResults.AddRange(cardGateResults);

                                // Small delay between cards
                                await Task.Delay(200);
                            }
                            catch (Exception ex)
                            {
                                Log.Warning(ex, "Failed to add personal card {Card} to gates", card);
                            }
                        }
                    }

                    await _firestoreService.AddPropertyAsync("hosts", data);
                    await _sqliteService.AddPropertyAsync(data, hostId);
                }

                // FIXED: Process carPlatesIndex updates individually with better error handling
                if (data.CardsInfo != null && data.CardsInfo.Any())
                {
                    foreach (var cardInfo in data.CardsInfo)
                    {
                        try
                        {
                            await _firestoreService.AddDocumentAsync("carPlatesIndex", cardInfo.CarPlate, new
                            {
                                docId = hostId,
                                cardNumber = cardInfo.Card
                            });
                        }
                        catch (Exception ex)
                        {
                            Log.Warning(ex, "Failed to update carPlatesIndex for card {Card} with plate {Plate}",
                                cardInfo.Card, cardInfo.CarPlate);
                            // Continue with other cards
                        }
                    }
                }

                return new ProcessResult
                {
                    Success = true,
                    GateResults = allGateResults
                };
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error processing approved property");
                return new ProcessResult
                {
                    Success = false,
                    ErrorMessage = ex.Message
                };
            }
        }

        private async Task UpdateGateStatuses(CardInfo cardInfo, List<GateRequestResult> gateResults)
        {
            if (gateResults == null) return;

            foreach (var result in gateResults)
            {
                if (GateService.Gates().FirstOrDefault(g => g.Name == result.GateName) is var gate && gate != null)
                {
                    cardInfo.SetGateStatus(gate.Id, result.Success);
                }
            }
        }

        [HttpDelete("remove-card")]
        public async Task<IActionResult> RemoveCardInfoByQuery([FromQuery] string cardNumber)
        {
            if (string.IsNullOrWhiteSpace(cardNumber))
            {
                return BadRequest(new { message = _localizer["InvalidQueryParameters"].Value });
            }

            try
            {
                // Step 1: Delete from Firestore
                bool success = await _firestoreService.DeleteCardDataAsync(cardNumber);
                if (!success)
                {
                    return NotFound(new { message = _localizer["DocumentNotFound"].Value });
                }

                // Step 2: Delete from SQLite
                await _sqliteService.RemoveCardAsync(cardNumber);

                // Step 3: Delete from all gates (with improved error handling)
                var userResult = await _userService.DeleteCardOnAllGatesAsync(cardNumber);

                // Step 4: Handle failed gate deletions (with logging)
                if (userResult.Any(r => !r.Success))
                {
                    await _firestoreService.HandleFailedGateDeletionsAsync(cardNumber, userResult);
                    Log.Warning("Card {CardNumber} deleted from DB but failed on some gates", cardNumber);
                }

                return Ok(userResult);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error removing card {CardNumber}", cardNumber);
                return StatusCode(500, new { message = _localizer["ServerError"].Value, details = ex.Message });
            }
        }


        // Add endpoint to delete pending property
        [HttpDelete("pending/{pendingId}")]
        public async Task<IActionResult> DeletePendingProperty(string pendingId)
        {
            try
            {
                // Delete from both SQLite and Firestore
                await _sqliteService.DeletePendingPropertyAsync(pendingId);

                //var pendingDocRef = _firestoreService._firestoreDb.Collection("pendingProperties").Document(pendingId);
                //await pendingDocRef.DeleteAsync();

                return Ok(new { message = _localizer["PendingPropertyDeleted"].Value });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error deleting pending property {PendingId}", pendingId);
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        // UPDATED: Replace Card with Verification Support
        [HttpPost("replace-card")]
        public async Task<IActionResult> ReplaceCard([FromBody] ReplaceCardRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.OldCardNo) || string.IsNullOrWhiteSpace(request.NewCardNo))
            {
                return BadRequest(new { message = _localizer["InvalidCardNumbers"].Value });
            }

            try
            {
                // Use request-specific setting, fallback to configuration default
                bool useVerification = request.UseVerificationWorkflow ??
                    _configuration.GetValue<bool>("GateManagement:UseVerificationWorkflow", false);

                // Route to appropriate workflow based on request
                if (useVerification)
                {
                    return await ReplaceCardWithVerification(request);
                }
                else
                {
                    return await ReplaceCardDirect(request);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error in ReplaceCard");
                return StatusCode(500, new { message = _localizer["ServerError"].Value, details = ex.Message });
            }
        }

        // Verification workflow for replace card
        private async Task<IActionResult> ReplaceCardWithVerification(ReplaceCardRequest request)
        {
            // Check if new card already exists
            var existingNewCards = await _firestoreService.QueryCollectionAsync(
                "carPlatesIndex",
                new[] { ("cardNumber", "==", (object)request.NewCardNo) }
            );

            if (existingNewCards.Any())
            {
                var existingCard = existingNewCards.First();
                return BadRequest(new
                {
                    message = _localizer["CardAlreadyExists", request.NewCardNo].Value + $" in {existingCard["docId"]?.ToString() ?? "unknown"}"
                });
            }

            // Check in pending (SQLite - local check)
            var pendingProperties = await _sqliteService.GetAllPendingPropertiesAsync();
            var conflictingPending = pendingProperties.FirstOrDefault(p =>
                p.PropertyData.CardsInfo?.Any(c => c.Card == request.NewCardNo) == true &&
                p.Status == PendingStatus.PendingReview);

            if (conflictingPending != null)
            {
                return BadRequest(new { message = _localizer["CardAlreadyPending", request.NewCardNo].Value });
            }

            // Create pending replace request
            var pendingReplace = new PendingReplaceCard
            {
                OldCardNo = request.OldCardNo,
                NewCardNo = request.NewCardNo,
                SubmittedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
                Status = PendingStatus.PendingReview,
                SubmittedBy = request.SubmittedBy,
                ReviewComments = new List<string>()
            };

            var pendingId = $"replace_{request.OldCardNo}_{DateTime.UtcNow:yyyyMMddHHmmss}";
            await _sqliteService.AddPendingReplaceCardAsync(pendingReplace, pendingId);

            return Ok(new
            {
                message = _localizer["ReplaceCardSubmittedForReview"].Value,
                pendingId = pendingId,
                status = "pending_review"
            });
        }

        // Direct replace card processing (original logic)
        private async Task<IActionResult> ReplaceCardDirect(ReplaceCardRequest request)
        {
            Log.Information("Starting card replacement: {OldCard} -> {NewCard}", request.OldCardNo, request.NewCardNo);

            // Step 1: Check if new card already exists
            var existingNewCards = await _firestoreService.QueryCollectionAsync(
                "carPlatesIndex",
                new[] { ("cardNumber", "==", (object)request.NewCardNo) }
            );

            if (existingNewCards.Any())
            {
                var existingCard = existingNewCards.First();
                return BadRequest(new
                {
                    message = _localizer["CardAlreadyExists", request.NewCardNo].Value + $" in {existingCard["docId"]?.ToString() ?? "unknown"}"
                });
            }

            // Step 2: Find the old card and get property info
            var existingOldCards = await _firestoreService.QueryCollectionAsync(
                "carPlatesIndex",
                new[] { ("cardNumber", "==", (object)request.OldCardNo) }
            );

            if (!existingOldCards.Any())
            {
                return NotFound(new { message = _localizer["CardNotFound", request.OldCardNo].Value });
            }

            var oldCardIndex = existingOldCards.First();
            string? docId = oldCardIndex["docId"]?.ToString() ?? string.Empty;

            // Step 3: Get the host document
            var hostDoc = await _firestoreService.GetDocumentAsync("hosts", docId);
            if (hostDoc == null)
            {
                return NotFound(new { message = _localizer["PropertyNotFound"].Value });
            }

            var property = Property.Deserialize(hostDoc);
            var cardInfo = property.CardsInfo.FirstOrDefault(c => c.Card == request.OldCardNo);

            if (cardInfo == null)
            {
                return NotFound(new { message = _localizer["CardNotFoundInProperty"].Value });
            }

            // Step 4: Delete old card from gates
            var deleteResult = await _userService.DeleteCardOnAllGatesAsync(request.OldCardNo);

            // Step 5: Add new card to gates
            var newUser = new CardEntry { CardNo = request.NewCardNo, Pin = request.NewCardNo };
            var addResult = await _userService.AddCardToAllGates(newUser, ActiveType.CarsOnly);

            // Step 6: Update Firestore with new card info
            var batch = _firestoreService._firestoreDb.StartBatch();

            // Update the card number in CardsInfo
            cardInfo.Card = request.NewCardNo;

            // Update host document
            var hostRef = _firestoreService._firestoreDb.Collection("hosts").Document(docId);
            var updatedCardsInfo = property.CardsInfo.Select(c => new
            {
                c.Card,
                c.CarPlate,
                ActiveGateIds = c.ActiveGateIds ?? new List<int>()
            }).ToList();

            batch.Update(hostRef, new Dictionary<string, object>
    {
        { "CardsInfo", updatedCardsInfo }
    });

            // Delete old carPlatesIndex entry
            var oldIndexRef = _firestoreService._firestoreDb.Collection("carPlatesIndex").Document(cardInfo.CarPlate);
            batch.Delete(oldIndexRef);

            // Add new carPlatesIndex entry
            var newIndexRef = _firestoreService._firestoreDb.Collection("carPlatesIndex").Document(cardInfo.CarPlate);
            batch.Set(newIndexRef, new
            {
                docId = docId,
                cardNumber = request.NewCardNo
            });

            await batch.CommitAsync();

            // Step 7: Update SQLite
            await _sqliteService.UpdatePropertyAsync(property, docId);
            await _sqliteService.UpsertPropertyCarCardsAsync(docId, property.CardsInfo);
            await _sqliteService.UpsertPropertyPersonalCardsAsync(docId, property.PersonalCards);

            // Step 8: Handle failed gate operations
            await HandleFailedGateOperations(docId, cardInfo, deleteResult, addResult);

            Log.Information("Card replacement completed successfully");

            return Ok(addResult);
        }

        // UPDATED: Extend Card with Verification Support
        [HttpPost("extend-card")]
        public async Task<IActionResult> ExtendCard([FromBody] ExtendCardRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CardNo) || string.IsNullOrWhiteSpace(request.NewEndDate))
            {
                return BadRequest(new { message = _localizer["InvalidExtendRequest"].Value });
            }

            try
            {
                // Use request-specific setting, fallback to configuration default
                bool useVerification = request.UseVerificationWorkflow ??
                    _configuration.GetValue<bool>("GateManagement:UseVerificationWorkflow", false);

                // Route to appropriate workflow based on request
                if (useVerification)
                {
                    return await ExtendCardWithVerification(request);
                }
                else
                {
                    return await ExtendCardDirect(request);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error in ExtendCard");
                return StatusCode(500, new { message = _localizer["ServerError"].Value, details = ex.Message });
            }
        }

        // Verification workflow for extend card
        private async Task<IActionResult> ExtendCardWithVerification(ExtendCardRequest request)
        {
            // Validate the new end date
            if (!DateTime.TryParse(request.NewEndDate, out DateTime newEndDate))
            {
                return BadRequest(new { message = _localizer["InvalidDateFormat"].Value });
            }

            if (newEndDate <= DateTime.UtcNow)
            {
                return BadRequest(new { message = _localizer["EndDateMustBeFuture"].Value });
            }

            // Find the card to verify it exists
            var existingCards = await _firestoreService.QueryCollectionAsync(
                "carPlatesIndex",
                new[] { ("cardNumber", "==", (object)request.CardNo) }
            );

            if (!existingCards.Any())
            {
                return NotFound(new { message = _localizer["CardNotFound", request.CardNo].Value });
            }

            // Create pending extend request with all property data
            var pendingExtend = new PendingExtendCard
            {
                CardNo = request.CardNo,
                NewEndDate = request.NewEndDate,
                HasPhoto = request.HasPhoto,
                SubmittedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"),
                Status = PendingStatus.PendingReview,
                SubmittedBy = request.SubmittedBy,
                ReviewComments = new List<string>(),
                // NEW: Store additional property data
                Name = request.Name,
                Type = request.Type,
                Phone = request.Phone,
                Building = request.Building,
                Flat = request.Flat,
                ContractPhotoUrl = request.ContractPhotoUrl
            };

            var pendingId = $"extend_{request.CardNo}_{DateTime.UtcNow:yyyyMMddHHmmss}";
            await _sqliteService.AddPendingExtendCardAsync(pendingExtend, pendingId);

            return Ok(new
            {
                message = _localizer["ExtendCardSubmittedForReview"].Value,
                pendingId = pendingId,
                status = "pending_review"
            });
        }


        // Direct extend card processing (original logic)
        private async Task<IActionResult> ExtendCardDirect(ExtendCardRequest request)
        {
            Log.Information("Starting card extension for card: {CardNo}", request.CardNo);

            // Step 1: Find the card and get property info
            var existingCards = await _firestoreService.QueryCollectionAsync(
                "carPlatesIndex",
                new[] { ("cardNumber", "==", (object)request.CardNo) }
            );

            if (!existingCards.Any())
            {
                return NotFound(new { message = _localizer["CardNotFound", request.CardNo].Value });
            }

            var cardIndex = existingCards.First();
            string? docId = cardIndex["docId"]?.ToString() ?? string.Empty;

            // Step 2: Get the host document
            var hostDoc = await _firestoreService.GetDocumentAsync("hosts", docId);
            if (hostDoc == null)
            {
                return NotFound(new { message = _localizer["PropertyNotFound"].Value });
            }

            var property = Property.Deserialize(hostDoc);

            // Step 3: Validate the new end date
            if (!DateTime.TryParse(request.NewEndDate, out DateTime newEndDate))
            {
                return BadRequest(new { message = _localizer["InvalidDateFormat"].Value });
            }

            if (newEndDate <= DateTime.UtcNow)
            {
                return BadRequest(new { message = _localizer["EndDateMustBeFuture"].Value });
            }

            // Step 4: Delete old card from gates
            var deleteResult = await _userService.DeleteCardOnAllGatesAsync(request.CardNo);

            // Step 5: Add card back to gates with new end date
            var newUser = new CardEntry
            {
                CardNo = request.CardNo,
                Pin = request.CardNo,
                EndTime = newEndDate.ToString("yyyyMMdd") // Format for gate system
            };
            var addResult = await _userService.AddCardToAllGates(newUser, ActiveType.CarsOnly);

            // Step 6: Update property with all provided data
            property.EndDate = DateTime.ParseExact(
                request.NewEndDate,
                "yyyy-MM-ddTHH:mm:ss.fffZ",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AdjustToUniversal
            );

            // NEW: Update additional property fields if provided
            if (!string.IsNullOrEmpty(request.Name))
                property.Name = request.Name;

            if (!string.IsNullOrEmpty(request.Phone))
                property.Phone = request.Phone;

            if (request.Building.HasValue)
                property.Building = request.Building.Value;

            if (request.Flat.HasValue)
                property.Flat = request.Flat.Value;

            if (!string.IsNullOrEmpty(request.Type))
                property.Type = request.Type;

            if (!string.IsNullOrEmpty(request.ContractPhotoUrl))
                property.Contract = request.ContractPhotoUrl;

            property.LastEdit = $"{request.SubmittedBy} {DateTime.Now}";

            // Step 7: Update Firestore with all changes
            var hostRef = _firestoreService._firestoreDb.Collection("hosts").Document(docId);
            var updates = new Dictionary<string, object>
    {
        { "endDate", request.NewEndDate },
        { "lastEdit", property.LastEdit }
    };

            // NEW: Add additional fields to update if provided
            if (!string.IsNullOrEmpty(request.Name))
                updates["name"] = request.Name;

            if (!string.IsNullOrEmpty(request.Phone))
                updates["phone"] = request.Phone;

            if (request.Building.HasValue)
                updates["building"] = request.Building.Value;

            if (request.Flat.HasValue)
                updates["flat"] = request.Flat.Value;

            if (!string.IsNullOrEmpty(request.Type))
                updates["type"] = request.Type;

            if (!string.IsNullOrEmpty(request.ContractPhotoUrl))
                updates["contract"] = request.ContractPhotoUrl;

            await hostRef.UpdateAsync(updates);

            // Step 8: Update SQLite
            await _sqliteService.UpdatePropertyAsync(property, docId);
            await _sqliteService.UpsertPropertyCarCardsAsync(docId, property.CardsInfo);
            await _sqliteService.UpsertPropertyPersonalCardsAsync(docId, property.PersonalCards);

            // Step 9: Handle failed gate operations
            var cardInfo = property.CardsInfo.FirstOrDefault(c => c.Card == request.CardNo);
            if (cardInfo != null)
            {
                await HandleFailedGateOperations(docId, cardInfo, deleteResult, addResult);
            }

            Log.Information("Card extension completed successfully");

            return Ok(new
            {
                message = _localizer["CardExtendedSuccessfully"].Value,
                docId = docId,
                gateResults = addResult
            });
        }

        // Verification endpoints for replace and extend operations
        [HttpPost("verify-replace/{pendingId}")]
        public async Task<IActionResult> VerifyReplaceCard(string pendingId, [FromBody] VerificationRequest request)
        {
            try
            {
                var pendingReplace = await _sqliteService.GetPendingReplaceCardAsync(pendingId);

                if (pendingReplace == null)
                {
                    return NotFound(new { message = _localizer["PendingReplaceNotFound"].Value });
                }

                if (request.Action == VerificationAction.Approve)
                {
                    // Create replace request and process directly
                    var replaceRequest = new ReplaceCardRequest
                    {
                        OldCardNo = pendingReplace.OldCardNo,
                        NewCardNo = pendingReplace.NewCardNo,
                        UseVerificationWorkflow = false // Force direct processing
                    };

                    var result = await ReplaceCardDirect(replaceRequest);

                    if (result is OkObjectResult)
                    {
                        // Update pending status
                        pendingReplace.Status = PendingStatus.Approved;
                        pendingReplace.ReviewedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                        pendingReplace.ReviewedBy = request.Reviewer;
                        pendingReplace.ReviewComments.Add(request.Comments ?? "Approved");

                        await _sqliteService.UpdatePendingReplaceCardAsync(pendingReplace, pendingId);

                        return Ok(new
                        {
                            message = _localizer["ReplaceCardApproved"].Value,
                            gateResults = ((OkObjectResult)result).Value
                        });
                    }
                    else
                    {
                        return result;
                    }
                }
                else if (request.Action == VerificationAction.Reject)
                {
                    // Reject the replace request
                    pendingReplace.Status = PendingStatus.Rejected;
                    pendingReplace.ReviewedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                    pendingReplace.ReviewedBy = request.Reviewer;
                    pendingReplace.ReviewComments.Add(request.Comments ?? "Rejected");

                    await _sqliteService.UpdatePendingReplaceCardAsync(pendingReplace, pendingId);

                    return Ok(new { message = _localizer["ReplaceCardRejected"].Value });
                }

                return BadRequest(new { message = _localizer["InvalidAction"].Value });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error verifying replace card");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        [HttpPost("verify-extend/{pendingId}")]
        public async Task<IActionResult> VerifyExtendCard(string pendingId, [FromBody] VerificationRequest request)
        {
            try
            {
                var pendingExtend = await _sqliteService.GetPendingExtendCardAsync(pendingId);

                if (pendingExtend == null)
                {
                    return NotFound(new { message = _localizer["PendingExtendNotFound"].Value });
                }

                if (request.Action == VerificationAction.Approve)
                {
                    // Create extend request with all property data and process directly
                    var extendRequest = new ExtendCardRequest
                    {
                        CardNo = pendingExtend.CardNo,
                        NewEndDate = pendingExtend.NewEndDate,
                        HasPhoto = pendingExtend.HasPhoto,
                        UseVerificationWorkflow = false, // Force direct processing
                        SubmittedBy = request.Reviewer, // Use reviewer as submitter for the direct process
                                                        // NEW: Include all property data
                        Name = pendingExtend.Name,
                        Type = pendingExtend.Type,
                        Phone = pendingExtend.Phone,
                        Building = pendingExtend.Building,
                        Flat = pendingExtend.Flat,
                        ContractPhotoUrl = pendingExtend.ContractPhotoUrl
                    };

                    var result = await ExtendCardDirect(extendRequest);

                    if (result is OkObjectResult)
                    {
                        // Update pending status
                        pendingExtend.Status = PendingStatus.Approved;
                        pendingExtend.ReviewedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                        pendingExtend.ReviewedBy = request.Reviewer;
                        pendingExtend.ReviewComments.Add(request.Comments ?? "Approved");

                        await _sqliteService.UpdatePendingExtendCardAsync(pendingExtend, pendingId);

                        return Ok(new
                        {
                            message = _localizer["ExtendCardApproved"].Value,
                            gateResults = ((OkObjectResult)result).Value
                        });
                    }
                    else
                    {
                        return result;
                    }
                }
                else if (request.Action == VerificationAction.Reject)
                {
                    // Reject the extend request
                    pendingExtend.Status = PendingStatus.Rejected;
                    pendingExtend.ReviewedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                    pendingExtend.ReviewedBy = request.Reviewer;
                    pendingExtend.ReviewComments.Add(request.Comments ?? "Rejected");

                    await _sqliteService.UpdatePendingExtendCardAsync(pendingExtend, pendingId);

                    return Ok(new { message = _localizer["ExtendCardRejected"].Value });
                }

                return BadRequest(new { message = _localizer["InvalidAction"].Value });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error verifying extend card");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        // Additional endpoints for pending replace and extend operations
        [HttpGet("pending/replace")]
        public async Task<IActionResult> GetPendingReplaceCards([FromQuery] PendingStatus? status = null)
        {
            try
            {
                  var targetStatus = status ?? PendingStatus.PendingReview;
                var pendingReplaces = await _sqliteService.GetPendingReplaceCardsByStatusAsync(targetStatus);
                return Ok(pendingReplaces);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error getting pending replace cards");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        [HttpGet("pending/extend")]
        public async Task<IActionResult> GetPendingExtendCards([FromQuery] PendingStatus? status = null)
        {
            try
            {
                  var targetStatus = status ?? PendingStatus.PendingReview;
                var pendingExtends = await _sqliteService.GetPendingExtendCardsByStatusAsync(targetStatus);
                return Ok(pendingExtends);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error getting pending extend cards");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        // Helper method to handle failed gate operations
        private async Task HandleFailedGateOperations(
            string docId,
            CardInfo cardInfo,
            List<GateRequestResult> deleteResults,
            List<GateRequestResult> addResults)
        {
            var batch = _firestoreService._firestoreDb.StartBatch();

            // Handle failed deletions
            if (deleteResults != null)
            {
                foreach (var result in deleteResults.Where(r => !r.Success))
                {
                    if (result.ErrorMessage == "Failed to Delete card. Gate Down")
                    {
                        var gate = GateService.Gates().FirstOrDefault(g => g.Name == result.GateName);
                        if (gate != null)
                        {
                            await AddToFailedCollection($"FailedDeleteToGate{gate.Id}", docId, cardInfo.Card, batch);
                        }
                    }
                }
            }

            // Handle failed additions
            if (addResults != null)
            {
                foreach (var result in addResults.Where(r => !r.Success))
                {
                    if (result.ErrorMessage != "Error: Card Not Found")
                    {
                        var gate = GateService.Gates().FirstOrDefault(g => g.Name == result.GateName);
                        if (gate != null)
                        {
                            await AddToFailedCollection($"FailedAddToGate{gate.Id}", docId, cardInfo.Card, batch);
                        }
                    }
                }
            }

            if (batch != null)
            {
                await batch.CommitAsync();
            }
        }

        // UPDATE Pending Property
        [HttpPut("pending/{pendingId}")]
        public async Task<IActionResult> UpdatePendingProperty(string pendingId, [FromBody] UpdatePendingPropertyRequest request)
        {
            try
            {
                var pendingProperty = await _sqliteService.GetPendingPropertyAsync(pendingId);

                if (pendingProperty == null)
                {
                    return NotFound(new { message = _localizer["PendingPropertyNotFound"].Value });
                }

                if (pendingProperty.Status == PendingStatus.Approved)
                {
                    return BadRequest(new { message = _localizer["CannotEditProcessedProperty"].Value });
                }

                // Validate new data before updating
                if (!request.Property.IsValid())
                {
                    var errors = ModelState
                        .SelectMany(error => error.Value.Errors
                            .Select(errorMsg => new { Key = error.Key, Message = _localizer[errorMsg.ErrorMessage].Value }))
                        .ToDictionary(e => e.Key, e => e.Message);
                    return BadRequest(new { message = errors });
                }

                // Check for conflicts with new data (car plates and personal cards)
                if (request.Property.CardsInfo != null)
                {
                    foreach (var cardInfo in request.Property.CardsInfo)
                    {
                        if (cardInfo == null) continue;
                        if (cardInfo.CarPlate == null) continue;
                        cardInfo.CarPlate = CardInfo.SanitizeCarPlate(cardInfo.CarPlate);

                        // Check existing car plate in hosts
                        if (await _firestoreService.GetDocumentAsync("carPlatesIndex", cardInfo.CarPlate) is var carPlateDoc && carPlateDoc != null)
                        {
                            return BadRequest(new { message = _localizer["CarPlateAlreadyExists", cardInfo.CarPlate].Value + $" in {carPlateDoc["docId"]?.ToString() ?? "unknown"}" });
                        }

                        // Check existing card in hosts
                        var existingCards = await _firestoreService.QueryCollectionAsync(
                            "carPlatesIndex",
                            new[] { ("cardNumber", "==", (object)cardInfo.Card) }
                        );

                        if (existingCards.Any())
                        {
                            var existingCard = existingCards.First();
                            return BadRequest(new { message = _localizer["CardAlreadyExists", cardInfo.Card].Value + $" in {existingCard["docId"]?.ToString() ?? "unknown"}" });
                        }

                        // Check in other pending properties (excluding current one)
                        var otherPendingHosts = await _sqliteService.GetAllPendingPropertiesAsync();
                        var conflictingPending = otherPendingHosts.FirstOrDefault(p =>
                            p.PropertyData.Phone != pendingId &&
                            p.PropertyData.CardsInfo?.Any(c => c.Card == cardInfo.Card || c.CarPlate == cardInfo.CarPlate) == true &&
                            p.Status == PendingStatus.PendingReview);

                        if (conflictingPending != null)
                        {
                            return BadRequest(new { message = _localizer["CardAlreadyPendingInOther", cardInfo.Card].Value });
                        }
                    }
                }

                if (request.Property.PersonalCards != null)
                {
                    foreach (var card in request.Property.PersonalCards)
                    {
                        // Check in hosts
                        var existingHosts = await _firestoreService.QueryCollectionAsync(
                            "hosts",
                            new[] { ("PersonalCards", "array-contains", (object)card) }
                        );

                        if (existingHosts.Any())
                        {
                            var existingHost = existingHosts.First();
                            return BadRequest(new { message = _localizer["CardAlreadyExists", card].Value + $" in {existingHost["flat"]?.ToString() ?? "unknown"}-{existingHost["building"]?.ToString() ?? "unknown"}" });
                        }

                        // Check in other pending properties (excluding current one)
                        var otherPendingHosts = await _sqliteService.GetAllPendingPropertiesAsync();
                        var conflictingPending = otherPendingHosts.FirstOrDefault(p =>
                            p.PropertyData.Phone != pendingId &&
                            p.PropertyData.PersonalCards?.Contains(card) == true &&
                            p.Status == PendingStatus.PendingReview);

                        if (conflictingPending != null)
                        {
                            return BadRequest(new { message = _localizer["CardAlreadyPendingInOther", card].Value });
                        }
                    }
                }

                // Update the pending property
                pendingProperty.PropertyData = request.Property;
                pendingProperty.CarPlates = request.Property.CardsInfo?.Select(c => c.CarPlate).ToList() ?? new List<string>();

                await _sqliteService.UpdatePendingPropertyAsync(pendingProperty, pendingId);

                return Ok(new { message = _localizer["PendingPropertyUpdated"].Value });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error updating pending property");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        // UPDATE Pending Replace Card
        [HttpPut("pending/replace/{pendingId}")]
        public async Task<IActionResult> UpdatePendingReplaceCard(string pendingId, [FromBody] UpdatePendingReplaceRequest request)
        {
            try
            {
                var pendingReplace = await _sqliteService.GetPendingReplaceCardAsync(pendingId);

                if (pendingReplace == null)
                {
                    return NotFound(new { message = _localizer["PendingReplaceNotFound"].Value });
                }

                if (pendingReplace.Status == PendingStatus.Approved)
                {
                    return BadRequest(new { message = _localizer["CannotEditProcessedReplace"].Value });
                }

                // Validate that old card exists
                var existingOldCards = await _firestoreService.QueryCollectionAsync(
                    "carPlatesIndex",
                    new[] { ("cardNumber", "==", (object)request.OldCardNo) }
                );

                if (!existingOldCards.Any())
                {
                    return BadRequest(new { message = _localizer["OldCardNotFound", request.OldCardNo].Value });
                }

                // Validate that new card doesn't exist
                var existingNewCards = await _firestoreService.QueryCollectionAsync(
                    "carPlatesIndex",
                    new[] { ("cardNumber", "==", (object)request.NewCardNo) }
                );

                if (existingNewCards.Any())
                {
                    var existingCard = existingNewCards.First();
                    return BadRequest(new { message = _localizer["CardAlreadyExists", request.NewCardNo].Value + $" in {existingCard["docId"]?.ToString() ?? "unknown"}" });
                }

                // Check in other pending operations
                var otherPendingReplaces = await _sqliteService.GetPendingReplaceCardsByStatusAsync(PendingStatus.PendingReview);
                var conflictingReplace = otherPendingReplaces.FirstOrDefault(p =>
                    p.OldCardNo != pendingReplace.OldCardNo && // Different pending item
                    (p.NewCardNo == request.NewCardNo || p.OldCardNo == request.NewCardNo));

                if (conflictingReplace != null)
                {
                    return BadRequest(new { message = _localizer["CardAlreadyPendingInOtherReplace", request.NewCardNo].Value });
                }

                // Update the pending replace
                pendingReplace.OldCardNo = request.OldCardNo;
                pendingReplace.NewCardNo = request.NewCardNo;

                await _sqliteService.UpdatePendingReplaceCardAsync(pendingReplace, pendingId);

                return Ok(new { message = _localizer["PendingReplaceUpdated"].Value });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error updating pending replace card");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        // UPDATE Pending Extend Card
        [HttpPut("pending/extend/{pendingId}")]
        public async Task<IActionResult> UpdatePendingExtendCard(string pendingId, [FromBody] UpdatePendingExtendRequest request)
        {
            try
            {
                var pendingExtend = await _sqliteService.GetPendingExtendCardAsync(pendingId);

                if (pendingExtend == null)
                {
                    return NotFound(new { message = _localizer["PendingExtendNotFound"].Value });
                }

                if (pendingExtend.Status == PendingStatus.Approved)
                {
                    return BadRequest(new { message = _localizer["CannotEditProcessedExtend"].Value });
                }

                // Validate that card exists
                var existingCards = await _firestoreService.QueryCollectionAsync(
                    "carPlatesIndex",
                    new[] { ("cardNumber", "==", (object)request.CardNo) }
                );

                if (!existingCards.Any())
                {
                    return BadRequest(new { message = _localizer["CardNotFound", request.CardNo].Value });
                }

                // Validate new end date
                if (!DateTime.TryParse(request.NewEndDate, out DateTime newEndDate))
                {
                    return BadRequest(new { message = _localizer["InvalidDateFormat"].Value });
                }

                if (newEndDate <= DateTime.UtcNow)
                {
                    return BadRequest(new { message = _localizer["EndDateMustBeFuture"].Value });
                }

                // Update the pending extend with all data
                pendingExtend.CardNo = request.CardNo;
                pendingExtend.NewEndDate = request.NewEndDate;
                pendingExtend.HasPhoto = request.HasPhoto;
                // NEW: Update additional property data
                pendingExtend.Name = request.Name;
                pendingExtend.Type = request.Type;
                pendingExtend.Phone = request.Phone;
                pendingExtend.Building = request.Building;
                pendingExtend.Flat = request.Flat;
                pendingExtend.ContractPhotoUrl = request.ContractPhotoUrl;

                await _sqliteService.UpdatePendingExtendCardAsync(pendingExtend, pendingId);

                return Ok(new { message = _localizer["PendingExtendUpdated"].Value });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error updating pending extend card");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }


        // Helper method to add cards to failed collections
        private async Task AddToFailedCollection(string collectionName, string docId, string cardNo, WriteBatch batch)
        {
            var failedDocRef = _firestoreService._firestoreDb.Collection(collectionName).Document(docId);
            var snapshot = await failedDocRef.GetSnapshotAsync();

            var existingFailedCards = new List<Dictionary<string, object>>();
            if (snapshot.Exists && snapshot.ContainsField("failedCards"))
            {
                existingFailedCards = snapshot.GetValue<List<Dictionary<string, object>>>("failedCards");
            }

            bool cardExists = existingFailedCards.Any(c =>
                c.ContainsKey("card") && (string)c["card"] == cardNo);

            if (!cardExists)
            {
                existingFailedCards.Add(new Dictionary<string, object> { { "card", cardNo } });
                var failedGateUpdate = new Dictionary<string, object> { { "failedCards", existingFailedCards } };
                batch.Set(failedDocRef, failedGateUpdate, SetOptions.MergeAll);
            }
        }


        [HttpGet("pending/property/{phone}")]
        public async Task<IActionResult> GetPendingOperationsByProperty(string phone)
        {
            try
            {
                var pendingProperties = await _sqliteService.GetAllPendingPropertiesAsync();
                var filteredProperties = pendingProperties.Where(p => p.PropertyData.Phone == phone).ToList();

                var pendingReplaces = await _sqliteService.GetPendingReplaceCardsByStatusAsync(PendingStatus.PendingReview);
                var filteredReplaces = new List<PendingReplaceCard>();

                var pendingExtends = await _sqliteService.GetPendingExtendCardsByStatusAsync(PendingStatus.PendingReview);
                var filteredExtends = pendingExtends.Where(e =>
                    !string.IsNullOrEmpty(e.Phone) && e.Phone == phone).ToList();

                // For replace cards, we need to find which property they belong to
                foreach (var replace in pendingReplaces)
                {
                    try
                    {
                        var cardQuery = await _firestoreService.QueryCollectionAsync(
                            "carPlatesIndex",
                            new[] { ("cardNumber", "==", (object)replace.OldCardNo) }
                        );

                        if (cardQuery.Any())
                        {
                            var cardIndex = cardQuery.First();
                            var hostId = cardIndex["docId"]?.ToString() ?? string.Empty;
                            var hostDoc = await _firestoreService.GetDocumentAsync("hosts", hostId);

                            if (hostDoc != null)
                            {
                                var property = Property.Deserialize(hostDoc);
                                if (property.Phone == phone)
                                {
                                    filteredReplaces.Add(replace);
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Log.Warning(ex, "Error checking replace card {Card} for phone {Phone}", replace.OldCardNo, phone);
                    }
                }

                var result = new
                {
                    Phone = phone,
                    PendingProperties = filteredProperties,
                    PendingReplaceCards = filteredReplaces,
                    PendingExtendCards = filteredExtends,
                    Summary = new
                    {
                        TotalPending = filteredProperties.Count + filteredReplaces.Count + filteredExtends.Count,
                        PendingPropertiesCount = filteredProperties.Count,
                        PendingReplacesCount = filteredReplaces.Count,
                        PendingExtendsCount = filteredExtends.Count
                    }
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error getting pending operations for property {Phone}", phone);
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

        [HttpGet("pending/status")]
        public async Task<IActionResult> GetPendingOperationsStatus()
        {
            try
            {
                var allPendingProperties = await _sqliteService.GetAllPendingPropertiesAsync();
                var pendingReplaces = await _sqliteService.GetPendingReplaceCardsByStatusAsync(PendingStatus.PendingReview);
                var pendingExtends = await _sqliteService.GetPendingExtendCardsByStatusAsync(PendingStatus.PendingReview);

                // Get approved/rejected counts
                var approvedProperties = allPendingProperties.Where(p => p.Status == PendingStatus.Approved).ToList();
                var rejectedProperties = allPendingProperties.Where(p => p.Status == PendingStatus.Rejected).ToList();
                var reviewPendingProperties = allPendingProperties.Where(p => p.Status == PendingStatus.PendingReview).ToList();

                var result = new
                {
                    Summary = new
                    {
                        TotalPending = reviewPendingProperties.Count + pendingReplaces.Count + pendingExtends.Count,
                        PendingProperties = reviewPendingProperties.Count,
                        PendingReplaceCards = pendingReplaces.Count,
                        PendingExtendCards = pendingExtends.Count,
                        ApprovedProperties = approvedProperties.Count,
                        RejectedProperties = rejectedProperties.Count
                    },
                    Details = new
                    {
                        PendingProperties = reviewPendingProperties.Select(p => new
                        {
                            PendingId = p.PropertyData.Phone,
                            p.PropertyData.Name,
                            p.PropertyData.Phone,
                            p.PropertyData.Building,
                            p.PropertyData.Flat,
                            p.PropertyData.Type,
                            CardsCount = p.PropertyData.CardsInfo?.Count ?? 0,
                            PersonalCardsCount = p.PropertyData.PersonalCards?.Count ?? 0,
                            p.SubmittedAt,
                            p.SubmittedBy
                        }),
                        PendingReplaces = pendingReplaces.Select(r => new
                        {
                            PendingId = $"replace_{r.OldCardNo}_{r.SubmittedAt}",
                            r.OldCardNo,
                            r.NewCardNo,
                            r.SubmittedAt,
                            r.SubmittedBy
                        }),
                        PendingExtends = pendingExtends.Select(e => new
                        {
                            PendingId = $"extend_{e.CardNo}_{e.SubmittedAt}",
                            e.CardNo,
                            e.NewEndDate,
                            e.Name,
                            e.Phone,
                            e.SubmittedAt,
                            e.SubmittedBy
                        })
                    }
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error getting pending operations status");
                return StatusCode(500, new { message = _localizer["ServerError"].Value });
            }
        }

    }

    // Request/Response Models
    public class UpdatePropertyRequest 
    { 
        [Required] 
        public Property Property { get; set; } 
        
        public List<string> PersonalCardPhotoUrls { get; set; } = new(); 
        
        public string SubmittedBy { get; set; } 
        
        public bool? UseVerificationWorkflow { get; set; } 
    }

    public class VerifyUpdatePropertyRequest
    {
        public VerificationAction Action { get; set; }
        public string Reviewer { get; set; }
        public string Comments { get; set; }
        public List<PersonalCardVerification> PersonalCardVerifications { get; set; } = new();
    }

    public class PersonalCardVerification
    {
        public string PhotoUrl { get; set; }
        public string CardNumber { get; set; }
    }

    public enum VerificationAction
    {
        Approve,
        Reject
    }

    public class ProcessResult
    {
        public bool Success { get; set; }
        public string ErrorMessage { get; set; }
        public string Message { get; set; }
        public List<GateRequestResult> GateResults { get; set; } = new();
    }
}
